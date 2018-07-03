ohg.init(document.getElementById("wglframe"));
ohg.backgroundColor = [0, 0, 0.25, 1];

chars = []
for (var asciiCode = 0; asciiCode < 256; asciiCode++)
{
    chars.push(String.fromCharCode(asciiCode));
}

ohg.loadAtlas("font", "https://webglfundamentals.org/webgl/resources/f-texture.png", 
              ohg.generateRegularGrid(chars, 96, 128, 6, 8));

ohg.loadAtlas("testAtlas", "http://localhost:8080/textures/font2-modified.png", //"https://webglfundamentals.org/webgl/resources/f-texture.png", 
              ohg.generateSingleCellGrid("img"));

var testLayer = ohg.addLayer("test", "testAtlas", "ohg-color-cut", 1, false);
ohg.layerSetShaderUniform(testLayer, "u_transparentColor", [0, 0, 0, 1]);
ohg.layerSetShaderUniform(testLayer, "u_threshold", 1.01);
ohg.layerSetQuad(testLayer, 0, [0.0, 0.0], [96.0, 128.0], "img");

