const S = 'C:/Users/Cece/AppData/Local/Temp/claude/56822494e25c6090/81819607-7547-4d59-b6bb-89f853e2365a/scratchpad';
const PPM = 40 * Math.SQRT2;
module.exports = {
  roots: { '/a/': S + '/asset-dl', '/x/': S + '/asset-x' },
  jobs: [
    { id: 'test.zombie', file: 'test/zombie.webp', spec: {
      url: '/a/gd-zombie-kit/Zombie/Zombie Basic.glb', height: 1.8, cell: [160, 160], anchor: [80, 100], ppm: PPM, blob: [0.35, 0.3],
      dirs: [0, 1, 2, 3, 4],
      blood: { url: '/a/gd-zombie-kit/Prop/Blood 1.glb', length: 1.3, castShadow: false },
      anims: [{ name: 'walk', clip: 'Walk', frames: 12 }, { name: 'death', clip: 'Death', frames: 16, loop: false, blood: 0.35 }],
    } },
  ],
};
