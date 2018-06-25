ohg.init(document.getElementById("wglframe"));

chars = []
for (var asciiCode = 0; asciiCode < 256; asciiCode++)
{
    chars.push(String.fromCharCode(asciiCode));
}

ohg.loadAtlas("font", "https://webglfundamentals.org/webgl/resources/f-texture.png", 
              ohg.generateRegularGrid(chars, 96, 128, 6, 8));

ohg.loadAtlas("testAtlas", "https://webglfundamentals.org/webgl/resources/f-texture.png", 
              ohg.generateSingleCellGrid("img"));

var testLayer = ohg.addLayer("test", "testAtlas", "ohg-opaque", 1, false);
ohg.layerSetQuad(testLayer, 0, [0.0, 0.0], [100, 100], "img");


