ohg = {};

(function()
{
    var initialized = false;
    var paused = false;
    var time = 0.0;
    var prevFrameTimestamp;
    var gl;
    var layers = [];
    var atlases = {};
    var shaders = {};
    var viewTransform = { translation: [0.0, 0.0], rotation: 0.0, scale: [1.0, 1.0], matrix: m3.identity() };
    var viewTransformChanged = true;
    const dummyShaderFunc = function (layer) {return undefined;}
    
    ohg.timeScale = 1.0;
    ohg.onUpdate = function(deltaTime, timeSinceStart) {}
    ohg.backgroundColor = [0, 0, 0, 1];

    ohg.init = function(canvas)
    {
        if (!initialized)
        {
            gl = canvas.getContext("webgl", {antialias: false});
            if (!gl)
            {
                console.error("OHG: Cannot retrieve WebGL context");
                return;        
            }
            
            initialized = true;
            ohg.loadShader("ohg-opaque");
            //console.log(shaders);
            //ohg.loadShader("ohg-alpha-cut");
            
            prevFrameTimestamp = performance.now();
            requestAnimationFrame(update);
        }
    }
    
    ohg.loadAtlas = function(name, imageURL, grid)
    {
        if (initialized)
        {
            if (name in atlases)
            {
                console.error("OHG: Atlas '".concat(name).concat("' already exists."));
                return;        
            }
            
            var atlas = {};            
            atlas.texture = gl.createTexture();
            atlas.grid = grid;
            gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
            const level = 0;
            const internalFormat = gl.RGBA;
            const width = 1;
            const height = 1;
            const border = 0;
            const srcFormat = gl.RGBA;
            const srcType = gl.UNSIGNED_BYTE;
            const pixel = new Uint8Array([255, 255, 255, 255]);  // opaque blue
            gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixel);
            //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
            //loadTextureAsync(atlas.texture, imageURL);
            atlases[name] = atlas;
        }
    }
    
    ohg.generateSingleCellGrid = function(glyphName)
    {
        //return {glyphName : {"pos" : [0.0, 0.0], "size" : [1.0, 1.0]}};
        grid = {};
        grid[glyphName] = {};
        grid[glyphName].pos = [0.0, 0.0];
        grid[glyphName].size = [1.0, 1.0];
        return grid;
    }
    
    ohg.generateRegularGrid = function(glyphNames, atlasWidth, atlasHeight, glyphWidth, glyphHeight)
    {
        var wCount = Math.floor(atlasWidth / glyphWidth);
        var hCount = Math.floor(atlasHeight / glyphHeight);
        var uvSize = [1.0/wCount, 1.0/hCount];
        var i = 0;
        var j = 0;
        grid = {};
        for (var name in glyphNames)
        {
            grid[name] = {};
            grid[name].pos = [uvSize[0]*i, 1.0 - uvSize[1]*(j+1)];
            grid[name].size = uvSize;
            i++;
            if (i == wCount)
            {
                i = 0;
                j++;
            }
        }
        return grid;
    }
    
    ohg.loadShader = function(shaderName, onInitFunc = dummyShaderFunc, onUseFunc = dummyShaderFunc)
    {
        if (initialized)
        {
            if (shaderName in shaders)
            {
                console.error("OHG: Shader '".concat(shaderName).concat("' already exists."));
                return;        
            }
            
            var shader = {};
            var vertexShaderSource = document.getElementById(shaderName.concat("-v")).text;
            var fragmentShaderSource = document.getElementById(shaderName.concat("-f")).text;
        
            // create GLSL shaders, upload the GLSL source, compile the shaders
            var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
            var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

            // Link the two shaders into a program
            shader.program = createProgram(gl, vertexShader, fragmentShader);
            shader.onInitFunc = onInitFunc;
            shader.onUseFunc = onUseFunc;
            shader.resolutionUniform = gl.getUniformLocation(shader.program, "u_resolution");
            shader.matrixUniform = gl.getUniformLocation(shader.program, "u_matrix");
            shader.textureUniform = gl.getUniformLocation(shader.program, "u_texture");
            shaders[shaderName] = shader;        
        }
    }

    ohg.pause = function()
    {
        paused = true;
    }

    ohg.resume = function()
    {
        if (initialized)
        {
            paused = false;
            requestAnimationFrame(update);
        }
    }
    
    ohg.viewSetTranslation = function(translation)
    {
        viewTransform.translation = translation;
        viewTransformChanged = true;
    }

    ohg.viewSetRotation = function(rotation)
    {
        viewTransform.rotation = rotation;
        viewTransformChanged = true;
    }
    
    ohg.viewSetScale = function(scale)
    {
        viewTransform.scale = scale;
        viewTransformChanged = true;
    }
        
    ohg.addLayer = function(name, atlasName, shaderName, numberOfQuads, isDynamic)
    {
        if (initialized)
        {
            var newLayer = {};
            newLayer.name = name;
            newLayer.index = layers.length;
            newLayer.shader = shaders[shaderName];
            newLayer.atlas = atlases[atlasName];
            newLayer.quads = new Array(numberOfQuads).fill().map(u => (quad()));
            newLayer.translation = [0.0, 0.0];
            newLayer.rotation = 0.0;
            newLayer.scale = [1.0, 1.0];
            newLayer.transform = m3.identity();
            newLayer.visible = true;
            newLayer.quadsChanged = true;
            newLayer.transformChanged = true;
            newLayer.numberOfIndices = 0;
            newLayer.drawType = isDynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
            
            newLayer.positions = new Float32Array(numberOfQuads*8);
            newLayer.positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, newLayer.positionBuffer);
            newLayer.positionAttr = gl.getAttribLocation(newLayer.shader.program, "a_position");
            
            newLayer.texCoords = new Float32Array(numberOfQuads*8);
            newLayer.texCoordsBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, newLayer.texCoordsBuffer);
            newLayer.texCoordsAttr = gl.getAttribLocation(newLayer.shader.program, "a_texcoord");
            
            newLayer.indices = new Uint16Array(numberOfQuads*6);
            newLayer.indicesBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, newLayer.indicesBuffer);
            
            layers.push(newLayer);
            
            newLayer.shader.onInitFunc(newLayer);
            
            return newLayer.index;
        }
    }
    
    ohg.getLayerIndex = function(name)
    {
        if (initialized)
        {
            return layers.find(function(layer) {return layer.name === name}).index;
        }
    }
    
    ohg.layerSetVisible = function(layerIndex, visible)
    {
        if (initialized)
        {
            layers[layerIndex].visible = visible;
        }
    }
    
    ohg.layerSwap = function(layerIndexA, layerIndexB)
    {
        if (initialized)
        {
            var layerA = layers[layerIndexA];
            layers[layerIndexA] = layers[layerIndexB];
            layers[layerIndexB] = layerA;
        }
    }
    
    ohg.layerSetTranslation = function(layerIndex, translation)
    {
        var layer = layers[layerIndex];
        layer.translation = translation;
        layer.transformChanged = true;
    }

    ohg.layerSetRotation = function(layerIndex, rotation)
    {
        var layer = layers[layerIndex];
        layer.rotation = rotation;
        layer.transformChanged = true;
    }
    
    ohg.layerSetScale = function(layerIndex, scale)
    {
        var layer = layers[layerIndex];
        layer.scale = scale;
        layer.transformChanged = true;
    }
    
    ohg.layerSetQuad = function(layerIndex, quadIndex, quadPosition, quadSize, glyphName)
    {
        if (initialized)
        {
            var layer = layers[layerIndex];
            layer.quadsChanged = true;
            var q = layers[layerIndex].quads[quadIndex];
            q.pos = [
                quadPosition[0],             quadPosition[1],
                quadPosition[0]+quadSize[0], quadPosition[1],
                quadPosition[0]+quadSize[0], quadPosition[1]+quadSize[1],
                quadPosition[0],             quadPosition[1]+quadSize[1]
            ];
            
            var uvPosition = layer.atlas.grid[glyphName].pos;
            var uvSize = layer.atlas.grid[glyphName].size;
            q.uv = [
                uvPosition[0],           uvPosition[1],
                uvPosition[0]+uvSize[0], uvPosition[1],
                uvPosition[0]+uvSize[0], uvPosition[1]+uvSize[1],
                uvPosition[0],           uvPosition[1]+uvSize[1]
            ];
            q.visible = true;
        }
    }
    
    function update(timestamp)
    {
        var deltaTime = (timestamp-prevFrameTimestamp)*0.0001*ohg.timeScale;        
        ohg.onUpdate(deltaTime, time);
        time += deltaTime;
        
        gl.viewport(-gl.canvas.width/2, -gl.canvas.height/2, gl.canvas.width, gl.canvas.height);
        gl.clearColor(ohg.backgroundColor[0], ohg.backgroundColor[1], ohg.backgroundColor[2], ohg.backgroundColor[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        if (viewTransformChanged)
        {            
            viewTransform.matrix = trs(viewTransform.translation[0], viewTransform.translation[1], viewTransform.rotation, viewTransform.scale[0], viewTransform.scale[1]);
            viewTransformChanged = false;
        }
        
        layers.forEach(function(layer)
        {
            if (layer.quadsChanged)
                buildLayerGeometry(layer);
            if (layer.visible)
                renderLayer(layer);
        }
        );
        
        if (!paused)
            requestAnimationFrame(update);
    }
    
    function quad()
    {
        var q = {};
        q.pos = new Array(8).fill(0.0);
        q.uv = new Array(8).fill(0.0);
        q.visible = false;
        return quad;
    }
    
    function trs(tx, ty, rot, sx, sy)
    {
        return m3.multiply(m3.multiply(m3.translation(tx, ty), m3.rotation(rot)), m3.scaling(sx, sy));
    }
        
    function isPowerOf2(value)
    {
        return (value & (value - 1)) == 0;
    }
    
    function loadTextureAsync(texture, imageURL)
    {
        var image = new Image();
        image.src = imageURL;
        image.crossOrigin = "";
        image.addEventListener('load', function() {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            //gl.generateMipmap(gl.TEXTURE_2D);            
            // WebGL1 has different requirements for power of 2 images
            // vs non power of 2 images so check if the image is a
            // power of 2 in both dimensions.
            if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
               // Yes, it's a power of 2. Generate mips.
               gl.generateMipmap(gl.TEXTURE_2D);
            } else {
               // No, it's not a power of 2. Turn of mips and set
               // wrapping to clamp to edge
               gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
               gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
               gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            }            
        });
    }
        
    function buildLayerGeometry(layer)
    {
        var indexCounter = 0;
        var posCounter = 0;
        var vertexCounter = 0;
        for (var quadIndex = 0; quadIndex < layer.quads.length; quadIndex++)
        {
            var quad = layer.quads[quadIndex];
            if (quad.visible)
            {
                layer.positions.set(quad.pos, posCounter);
                layer.texCoords.set(quad.uv, posCounter);
                // 12
                // 03
                layer.indices.set([vertexCounter, vertexCounter+1, vertexCounter+3,
                                   vertexCounter+1, vertexCounter+2, vertexCounter+3], indexCounter);
                vertexCounter += 4;
                posCounter += 8;
                indexCounter += 6;
            }
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, layer.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, layer.positions, layer.drawType);
        gl.bindBuffer(gl.ARRAY_BUFFER, layer.texCoordsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, layer.texCoords, layer.drawType);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, layer.indicesBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, layer.indices, layer.drawType);
        layer.numberOfIndices = indexCounter;
        layer.quadsChanged = false;
    }
    
    function renderLayer(layer)
    {        
        gl.bindBuffer(gl.ARRAY_BUFFER, layer.positionBuffer);
        //gl.bufferData(gl.ARRAY_BUFFER, layer.positions, layer.drawType);
        gl.vertexAttribPointer(layer.positionAttr, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(layer.positionAttr);

        gl.bindBuffer(gl.ARRAY_BUFFER, layer.texCoordsBuffer);
        //gl.bufferData(gl.ARRAY_BUFFER, layer.texCoords, layer.drawType);
        gl.vertexAttribPointer(layer.texCoordsAttr, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(layer.texCoordsAttr);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, layer.indicesBuffer);
        //gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, layer.indices, layer.drawType);
        
        gl.useProgram(layer.shader.program);

        gl.uniform2f(layer.shader.resolutionUniform, gl.canvas.width, gl.canvas.height);
        
        if (layer.transformChanged)
        {
            layer.transform = trs(layer.translation[0], layer.translation[1], layer.rotation, layer.scale[0], layer.scale[1]);
            layer.transformChanged = false;
        }        
        var totalTransform = m3.multiply(layer.transform, viewTransform.matrix);
        gl.uniformMatrix3fv(layer.shader.matrixUniform, false, totalTransform);
        
        gl.uniform1i(layer.shader.textureUniform, 0);                
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, layer.atlas.texture);        
        
        layer.shader.onUseFunc(layer);

        gl.drawElements(gl.TRIANGLES, layer.numberOfIndices, gl.UNSIGNED_SHORT, 0);
    }
    
    function createShader(gl, type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (success) {
          return shader;
        }
      
        console.log(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
      }
      
      function createProgram(gl, vertexShader, fragmentShader) {
        var program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        var success = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (success) {
          return program;
        }
        console.log(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
      }
}
).call(ohg);