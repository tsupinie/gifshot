/*
  processFrameWorker.js
  =====================
*/

/* Copyright  2017 Yahoo Inc.
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file for terms.
*/

import NeuQuant from '../dependencies/NeuQuant';

export default function workerCode () {
    const self = this;

    try {
        self.onmessage = function (ev) {
            var data = ev.data || {};
            var response;

            if (data.gifshot){
                response = workerMethods.run(data);
                postMessage(response);
            }
        };
    } catch (e) {};

    const workerMethods = {
        dataToRGB: function (data, width, height, ignore_colors) {
            const length = width * height * 4;
            let i = 0;
            let rgb = [];

            while (i < length) {
                let pix = data[i] << 16 | data[i + 1] << 8 | data[i + 2];
                if (!ignore_colors.includes(pix)) {
                    rgb.push(data[i++]);
                    rgb.push(data[i++]);
                    rgb.push(data[i++]);
                    i++; // for the alpha channel which we don't care about
                }
                else{
                    i += 4;
                }
            }

            return rgb;
        },
        componentizedPaletteToArray: function (paletteRGB) {
            paletteRGB = paletteRGB || [];

            let paletteArray = [];

            for (let i = 0; i < paletteRGB.length; i += 3) {
                let r = paletteRGB[i];
                let g = paletteRGB[i + 1];
                let b = paletteRGB[i + 2];

                paletteArray.push(r << 16 | g << 8 | b);
            }

            return paletteArray;
        },
        // This is the "traditional" Animated_GIF style of going from RGBA to indexed color frames
        'processFrameWithQuantizer': function (imageData, width, height, sampleInterval, ncolors, colorHints) {
            const colorHintsPacked = colorHints.map(c => c[0] << 16 | c[1] << 8 | c[2]);
            let rgbComponents = this.dataToRGB(imageData, width, height, colorHintsPacked);

            let neuquant_colors = ncolors - colorHints.length;
            let nq = new NeuQuant(rgbComponents, rgbComponents.length, sampleInterval, neuquant_colors);
            let paletteRGB = nq.process();

            let paletteArray = this.componentizedPaletteToArray(paletteRGB).concat(colorHintsPacked);
            paletteArray = new Uint32Array(paletteArray);
            let numberPixels = width * height;
            let indexedPixels = new Uint8Array(numberPixels);
            let k = 0;

            for (let i = 0; i < numberPixels; i++) {
                let pix = imageData[i * 4] << 16 | imageData[i * 4 + 1] << 8 | imageData[i * 4 + 2];
                let chIndex = colorHintsPacked.indexOf(pix);
                if (chIndex < 0) {
                    let r = rgbComponents[k++];
                    let g = rgbComponents[k++];
                    let b = rgbComponents[k++];
                    indexedPixels[i] = nq.map(r, g, b);
                }
                else {
                    indexedPixels[i] = neuquant_colors + chIndex;
                }
            }

            return {
                pixels: indexedPixels,
                palette: paletteArray
            };
        },
        'run': function (frame) {
            frame = frame || {};

            let {
                height,
                palette,
                sampleInterval,
                width,
                ncolors,
                colorHints
            } = frame;
            const imageData = frame.data;

            return this.processFrameWithQuantizer(imageData, width, height, sampleInterval, ncolors, colorHints);
        }
    };

    return workerMethods;
};
