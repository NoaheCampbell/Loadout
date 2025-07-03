import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure build/icons directory exists
const iconsDir = path.join(__dirname, '..', 'build', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sourcePath = path.join(__dirname, '..', 'public', 'Loadout.png');

// Generate PNG files in various sizes for Linux and general use
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

async function generateIcons() {
  console.log('🎨 Generating app icons from Loadout.png...');
  
  try {
    // Generate PNG files in various sizes
    for (const size of sizes) {
      const outputPath = path.join(iconsDir, `icon_${size}x${size}.png`);
      await sharp(sourcePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      console.log(`✅ Generated ${size}x${size}.png`);
    }
    
    // Copy the largest as the main icon.png
    await sharp(sourcePath)
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(iconsDir, 'icon.png'));
    console.log('✅ Generated icon.png');
    
    // Generate Windows ICO file
    console.log('🔄 Generating Windows .ico file...');
    try {
      // First check if ImageMagick is installed
      try {
        execSync('magick -version', { stdio: 'ignore' });
        // Use magick for ImageMagick v7
        const icoSizes = [16, 24, 32, 48, 64, 128, 256];
        const convertArgs = icoSizes
          .map(size => `"${path.join(iconsDir, `icon_${size}x${size}.png`)}"`)
          .join(' ');
        
        execSync(`magick ${convertArgs} "${path.join(iconsDir, 'icon.ico')}"`, {
          stdio: 'inherit'
        });
      } catch {
        // Fall back to convert for older versions
        execSync('convert -version', { stdio: 'ignore' });
        const icoSizes = [16, 24, 32, 48, 64, 128, 256];
        const convertArgs = icoSizes
          .map(size => `"${path.join(iconsDir, `icon_${size}x${size}.png`)}"`)
          .join(' ');
        
        execSync(`convert ${convertArgs} "${path.join(iconsDir, 'icon.ico')}"`, {
          stdio: 'inherit'
        });
      }
      console.log('✅ Generated icon.ico');
    } catch (error) {
      console.log('⚠️  ImageMagick not found. Generating basic ICO...');
      // Use png2ico as fallback (will need to be installed)
      const png256 = path.join(iconsDir, 'icon_256x256.png');
      const icoPath = path.join(iconsDir, 'icon.ico');
      try {
        execSync(`png2ico "${icoPath}" "${png256}"`, { stdio: 'inherit' });
        console.log('✅ Generated icon.ico with png2ico');
      } catch (e) {
        console.error('❌ Could not generate .ico file. Please install ImageMagick or png2ico');
        console.error('   macOS: brew install imagemagick');
        console.error('   or: npm install -g png2ico');
      }
    }
    
    // Generate macOS ICNS file
    console.log('🔄 Generating macOS .icns file...');
    
    // Create iconset directory
    const iconsetPath = path.join(iconsDir, 'icon.iconset');
    if (!fs.existsSync(iconsetPath)) {
      fs.mkdirSync(iconsetPath);
    }
    
    // macOS iconset requires specific sizes and names
    const macSizes = [
      { size: 16, name: 'icon_16x16.png' },
      { size: 32, name: 'icon_16x16@2x.png' },
      { size: 32, name: 'icon_32x32.png' },
      { size: 64, name: 'icon_32x32@2x.png' },
      { size: 128, name: 'icon_128x128.png' },
      { size: 256, name: 'icon_128x128@2x.png' },
      { size: 256, name: 'icon_256x256.png' },
      { size: 512, name: 'icon_256x256@2x.png' },
      { size: 512, name: 'icon_512x512.png' },
      { size: 1024, name: 'icon_512x512@2x.png' }
    ];
    
    for (const { size, name } of macSizes) {
      await sharp(sourcePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(path.join(iconsetPath, name));
    }
    
    // Convert iconset to icns (macOS only)
    if (process.platform === 'darwin') {
      try {
        execSync(`iconutil -c icns "${iconsetPath}" -o "${path.join(iconsDir, 'icon.icns')}"`, {
          stdio: 'inherit'
        });
        console.log('✅ Generated icon.icns');
        
        // Clean up iconset directory
        fs.rmSync(iconsetPath, { recursive: true });
      } catch (error) {
        console.error('❌ Failed to generate .icns file:', error.message);
        console.error('   This is normal on non-macOS systems.');
      }
    } else {
      console.log('⚠️  Skipping .icns generation (requires macOS)');
    }
    
    // Copy loadout.png to public/favicon.ico replacement
    console.log('🔄 Updating favicon...');
    
    // Generate a proper favicon.ico with multiple sizes
    const faviconSizes = [16, 32, 48];
    const faviconPngs = [];
    
    for (const size of faviconSizes) {
      const tempPath = path.join(iconsDir, `favicon_${size}.png`);
      await sharp(sourcePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(tempPath);
      faviconPngs.push(tempPath);
    }
    
    // Try to create multi-size ICO for favicon
    const faviconPath = path.join(__dirname, '..', 'public', 'favicon.ico');
    try {
      // Try magick first (ImageMagick v7)
      try {
        execSync('magick -version', { stdio: 'ignore' });
        execSync(`magick ${faviconPngs.map(p => `"${p}"`).join(' ')} "${faviconPath}"`, {
          stdio: 'inherit'
        });
        console.log('✅ Updated favicon.ico');
      } catch {
        // Fall back to convert for older versions
        if (process.platform === 'win32' || fs.existsSync('/usr/bin/convert') || fs.existsSync('/usr/local/bin/convert')) {
          execSync(`convert ${faviconPngs.map(p => `"${p}"`).join(' ')} "${faviconPath}"`, {
            stdio: 'inherit'
          });
          console.log('✅ Updated favicon.ico');
        } else {
          // Fallback: just copy the 32x32 as favicon
          fs.copyFileSync(path.join(iconsDir, 'favicon_32.png'), faviconPath);
          console.log('✅ Updated favicon.ico (single size)');
        }
      }
    } catch (e) {
      console.log('⚠️  Could not create multi-size favicon.ico');
      // Copy 32x32 PNG as fallback
      fs.copyFileSync(path.join(iconsDir, 'favicon_32.png'), faviconPath);
    }
    
    // Clean up temporary favicon PNGs
    faviconPngs.forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
    
    console.log('\n✨ Icon generation complete!');
    console.log('📁 Icons saved to:', iconsDir);
    
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

// Run the script
generateIcons(); 