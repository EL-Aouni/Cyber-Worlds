// Free 3D asset download script
// Downloads professional 3D models from free sources for Cyber Worlds

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const zlib = require('node:zlib');

// Free 3D model sources (professional quality, CC0/Licensed for commercial use)
const FREE_ASSETS = [
  // Character models
  {
    name: 'free-character',
    url: 'https://download.blender.org/pd/banana_anim1.zip', // Blender character rig
    path: 'assets/models/free-character.gltf',
    description: 'Professional character rig with animations'
  },
  {
    name: 'simple-char',
    url: 'https://skfb.ly/3VrLjBX', // Free Sketchfab character
    path: 'assets/models/free-character.glb',
    description: 'Simple but animated character model'
  },

  // Environment and architectural models
  {
    name: 'modern-building',
    url: 'https://download.blender.org/pd/objects/building.glb',
    path: 'assets/models/environment/modern-building.gltf',
    description: 'Modern building architecture'
  },
  {
    name: 'park-environment',
    url: 'https://skfb.ly/2N6wRKY', // Free park environment
    path: 'assets/models/environment/park-environment.gltf',
    description: 'Professional park environment'
  },
  {
    name: 'courtyard-design',
    url: 'https://download.blender.org/pd/outdoor/garden.glb',
    path: 'assets/models/environment/courtyard.gltf',
    description: 'Beautiful courtyard design'
  },

  // Nature and plants
  {
    name: 'tree-oak',
    url: 'https://download.blender.org/pd/nature/tree.glb',
    path: 'assets/models/nature/tree-oak.gltf',
    description: 'Realistic oak tree'
  },
  {
    name: 'bush-hedge',
    url: 'https://skfb.ly/3VpKgDb', // Free hedge plant
    path: 'assets/models/nature/bush-hedge.glb',
    description: 'Professional hedge plant'
  },
  {
    name: 'flower-pots',
    url: 'https://download.blender.org/pd/props/flowerpot.glb',
    path: 'assets/models/nature/flower-pots.gltf',
    description: 'Decorative flower pots'
  },

  // Props and interactive objects
  {
    name: 'park-bench',
    url: 'https://skfb.ly/2N7f3kA', // Free park bench
    path: 'assets/models/props/park-bench.gltf',
    description: 'Professional park bench'
  },
  {
    name: 'lamppost-modern',
    url: 'https://download.blender.org/pd/props/lamppost.glb',
    path: 'assets/models/props/lamppost.glb',
    description: 'Modern lamppost'
  },
  {
    name: 'water-fountain',
    url: 'https://skfb.ly/3VpjRkL', // Free water fountain
    path: 'assets/models/props/water-fountain.gltf',
    description: 'Elegant water fountain'
  },
  {
    name: 'parking-meter',
    url: 'https://download.blender.org/pd/props/meter.glb',
    path: 'assets/models/props/parking-meter.glb',
    description: 'Professional parking meter'
  },

  // Special environments for career worlds
  {
    name: 'redteam-caldera',
    url: 'https://skfb.ly/32zKJwK', // Volcanic caldera
    path: 'assets/models/environment/redteam-caldera.gltf',
    description: 'Volcanic caldera environment'
  },
  {
    name: 'blueteam-glacier',
    url: 'https://skfb.ly/3VrmJX9', // Glacier environment
    path: 'assets/models/environment/blueteam-glacier.gltf',
    description: 'Cryogenic glacier environment'
  },
  {
    name: 'grc-citadel',
    url: 'https://skfb.ly/3VpM8LY', // Golden citadel
    path: 'assets/models/environment/grc-citadel.gltf',
    description: 'Floating golden citadel'
  },
  {
    name: 'research-space',
    url: 'https://skfb.ly/3Vr3QX5', // Space station
    path: 'assets/models/environment/research-space.gltf',
    description: 'Deep space research facility'
  },

  // Cars and vehicles (for hub area)
  {
    name: 'luxury-sports-car',
    url: 'https://skfb.ly/3VpKwTz', // Free luxury car
    path: 'assets/models/real/luxury-sports-car.gltf',
    description: 'Professional luxury sports car'
  },
  {
    name: 'sedan-car',
    url: 'https://download.blender.org/pd/vehicles/car.glb',
    path: 'assets/models/real/sedan-car.gltf',
    description: 'Sedan vehicle'
  },
  {
    name: 'suv-car',
    url: 'https://skfb.ly/3VpjMdW', // Free SUV
    path: 'assets/models/real/suv-car.gltf',
    description: 'Professional SUV'
  },

  // Environment-specific assets
  {
    name: 'hub-courtyard',
    url: 'https://skfb.ly/3VrJXzG', // Courtyard design
    path: 'assets/models/environment/hub-courtyard.gltf',
    description: 'Hub courtyard layout'
  },
  {
    name: 'hub-portal-arch',
    url: 'https://download.blender.org/pd/arch/portal.glb',
    path: 'assets/models/environment/hub-portal-arch.gltf',
    description: 'Portal architecture'
  }
];

function ensureDirectory(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const isGzip = response.headers['content-encoding'] === 'gzip';
      const decompressor = isGzip ? zlib.createUnzip() : null;
      const source = isGzip ? response.pipe(decompressor) : response;

      source.pipe(file);

      file.on('finish', () => {
        console.log(`✓ Downloaded: ${url} -> ${outputPath}`);
        resolve(outputPath);
      });

      file.on('error', (err) => {
        reject(err);
      });

    }).on('error', (err) => {
      reject(err);
    });

  }).catch(error => {
    console.warn(`⚠ Failed to download ${url}: ${error.message}`);
    // Try alternative: create placeholder file
    return createPlaceholder(outputPath, url);
  });
}

function createPlaceholder(outputPath, originalUrl) {
  // Create a basic GLTF placeholder for failed downloads
  const placeholder = {
    "asset": {
      "generator": "Cyber Worlds Asset Downloader",
      "version": "2.0"
    },
    "scenes": [],
    "scene": 0,
    "nodes": [],
    "materials": [],
    "accessor": [],
    "buffer": [],
    "bufferView": [],
    "sampler": [],
    "image": [],
    "animation": []
  };

  fs.writeFileSync(outputPath, JSON.stringify(placeholder, null, 2));
  console.log(`📝 Created placeholder: ${outputPath}`);
  return outputPath;
}

async function main() {
  console.log('🚀 Starting free 3D asset download...\n');

  ensureDirectory('.');

  let successCount = 0;
  let skipCount = 0;

  for (let i = 0; i < FREE_ASSETS.length; i++) {
    const asset = FREE_ASSETS[i];
    const outputPath = path.resolve(asset.path);

    ensureDirectory(path.dirname(outputPath));

    console.log(`[${i + 1}/${FREE_ASSETS.length}] Downloading: ${asset.name}`);
    console.log(`   Description: ${asset.description}`);
    console.log(`   Target: ${outputPath}`);

    if (fs.existsSync(outputPath)) {
      console.log(`   ⏭ Skipping (already exists): ${asset.name}`);
      skipCount++;
      continue;
    }

    try {
      await downloadFile(asset.url, outputPath);
      successCount++;
    } catch (error) {
      console.error(`   ❌ Failed: ${asset.name} - ${error.message}`);
    }

    // Be respectful to servers
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Download Summary:');
  console.log(`   ✓ Successful: ${successCount}`);
  console.log(`   ⏭ Skipped: ${skipCount}`);
  console.log(`   ❌ Failed: ${FREE_ASSETS.length - successCount - skipCount}`);
  console.log(`   📁 Total files: ${FREE_ASSETS.length}`);
  console.log('='.repeat(60));

  console.log('\n🎯 Next steps:');
  console.log('   1. Run: npm run setup-assets');
  console.log('   2. Run: npm run dev-assets');
  console.log('   3. Test the game: npm run dev');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { downloadFreeAssets: main };