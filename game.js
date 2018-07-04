ohg.init(document.getElementById("wglframe"));
ohg.backgroundColor = [0, 0, 0.25, 1];

chars = []
for (var asciiCode = 0; asciiCode < 256; asciiCode++)
{
    chars.push(String.fromCharCode(asciiCode));
}

ohg.loadAtlas("font", "http://localhost:8080/textures/font2-modified.png", 
              ohg.generateRegularGrid(chars, 96, 128, 6, 8));

ohg.loadAtlas("testAtlas", "http://localhost:8080/textures/font2-modified.png", //"https://webglfundamentals.org/webgl/resources/f-texture.png", 
              ohg.generateSingleCellGrid("img"));

/*
var testLayer = ohg.addLayer("test", "font", "ohg-color-cut", 3, false);
ohg.layerSetShaderUniform(testLayer, "u_transparentColor", [0, 0, 0, 1]);
ohg.layerSetShaderUniform(testLayer, "u_threshold", 0.01);
ohg.layerSetQuad(testLayer, 0, [0.0, 0.0], [6.0, 8.0], "a");
ohg.layerSetQuad(testLayer, 1, [6.0, 0.0], [6.0, 8.0], "b");
ohg.layerSetQuad(testLayer, 2, [12.0, 0.0], [6.0, 8.0], "c");
*/

var textLayer = ohg.addTextLineLayer("helloWorld", "font", "ohg-color-cut", "Hello, World!", 6, 8);
ohg.layerSetShaderUniform(textLayer, "u_transparentColor", [0, 0, 0, 1]);
ohg.layerSetShaderUniform(textLayer, "u_threshold", 0.01);
