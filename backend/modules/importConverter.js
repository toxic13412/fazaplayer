const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = promisify(exec);

/**
 * Convert audio file to MP3 192kbps using ffmpeg
 * @param {string} inputPath - Path to input audio file
 * @param {string} outputPath - Path to output MP3 file
 * @returns {Promise<void>}
 */
async function convertToMp3(inputPath, outputPath) {
  try {
    const command = `ffmpeg -i "${inputPath}" -codec:a libmp3lame -b:a 192k "${outputPath}" -y`;
    await execAsync(command);
    console.log(`✓ Converted ${inputPath} to MP3`);
  } catch (error) {
    console.error(`Error converting ${inputPath} to MP3:`, error.message);
    throw error;
  }
}

/**
 * Download audio from URL using yt-dlp
 * @param {string} url - URL to download from
 * @param {string} outputDir - Directory to save downloaded file
 * @returns {Promise<string>} - Path to downloaded file
 */
async function downloadWithYtDlp(url, outputDir) {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputTemplate = path.join(outputDir, '%(id)s.%(ext)s');
    const command = `yt-dlp -x --audio-format mp3 --audio-quality 192K -o "${outputTemplate}" "${url}"`;
    
    const { stdout } = await execAsync(command);
    console.log(`✓ Downloaded ${url}`);

    // Parse output to find downloaded file
    // This is simplified - in production, parse yt-dlp output more carefully
    const files = fs.readdirSync(outputDir);
    const latestFile = files
      .map(f => ({ name: f, time: fs.statSync(path.join(outputDir, f)).mtime }))
      .sort((a, b) => b.time - a.time)[0];

    return path.join(outputDir, latestFile.name);
  } catch (error) {
    console.error(`Error downloading ${url}:`, error.message);
    throw error;
  }
}

/**
 * Extract metadata from audio file using ffprobe
 * @param {string} filePath - Path to audio file
 * @returns {Promise<object>} - Metadata object
 */
async function extractMetadata(filePath) {
  try {
    const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
    const { stdout } = await execAsync(command);
    const data = JSON.parse(stdout);

    const duration = parseFloat(data.format.duration) || 0;
    const tags = data.format.tags || {};

    return {
      title: tags.title || tags.TITLE || 'Unknown',
      artist: tags.artist || tags.ARTIST || 'Unknown',
      album: tags.album || tags.ALBUM || null,
      genre: tags.genre || tags.GENRE || null,
      durationSeconds: Math.floor(duration)
    };
  } catch (error) {
    console.error(`Error extracting metadata from ${filePath}:`, error.message);
    return {
      title: 'Unknown',
      artist: 'Unknown',
      album: null,
      genre: null,
      durationSeconds: 180
    };
  }
}

module.exports = {
  convertToMp3,
  downloadWithYtDlp,
  extractMetadata
};
