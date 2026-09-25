'use strict';
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');

const router = express.Router();

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB raw image upload
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB video upload
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_MIME = ['video/mp4', 'video/webm'];

// Buffer uploads in memory; we then either process (image) or write (video).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES }, // hard ceiling; per-type checked below
  fileFilter(req, file, cb) {
    if (IMAGE_MIME.includes(file.mimetype) || VIDEO_MIME.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Only JPG, PNG, WebP images or MP4/WebM videos are allowed.'));
  },
});

function extForVideo(mime) {
  return mime === 'video/webm' ? 'webm' : 'mp4';
}

// POST /api/upload - accepts a single "image" or "media" field (image or video).
// Optional: crop = "left,top,width,height" (images only).
router.post('/', (req, res) => {
  // Accept the field under either name for backward compatibility.
  const handler = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'media', maxCount: 1 },
  ]);

  handler(req, res, async (err) => {
    if (err) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'File is too large (images max 15MB, videos max 100MB).'
          : err.message;
      return res.status(400).json({ error: msg });
    }

    const file =
      (req.files && req.files.image && req.files.image[0]) ||
      (req.files && req.files.media && req.files.media[0]);
    if (!file) {
      return res.status(400).json({ error: 'No file provided.' });
    }

    try {
      store.ensureDirs();
      const id = uuidv4();

      // ---- VIDEO ----
      if (VIDEO_MIME.includes(file.mimetype)) {
        if (file.size > MAX_VIDEO_BYTES) {
          return res.status(400).json({ error: 'Video is too large (max 100MB).' });
        }
        const ext = extForVideo(file.mimetype);
        const filename = `work-${id}.${ext}`;
        const diskPath = path.join(store.WORKS_UPLOAD_DIR, filename);
        fs.writeFileSync(diskPath, file.buffer);
        const publicPath = `/uploads/works/${filename}`;
        return res.status(201).json({ type: 'video', path: publicPath, thumb: null });
      }

      // ---- IMAGE ----
      if (file.size > MAX_IMAGE_BYTES) {
        return res.status(400).json({ error: 'Image is too large (max 15MB).' });
      }
      const filename = `work-${id}.jpg`;
      const diskPath = path.join(store.WORKS_UPLOAD_DIR, filename);

      function cropParts() {
        const raw = req.body.crop || req.query.crop;
        if (!raw) return null;
        const parts = String(raw).split(',').map((n) => Math.round(parseFloat(n)));
        if (parts.length === 4 && parts.every((n) => !Number.isNaN(n)) && parts[2] > 0 && parts[3] > 0) {
          return { left: Math.max(0, parts[0]), top: Math.max(0, parts[1]), width: parts[2], height: parts[3] };
        }
        return null;
      }

      let pipeline = sharp(file.buffer, { failOn: 'none' }).rotate();
      const crop = cropParts();
      if (crop) pipeline = pipeline.extract(crop);
      await pipeline
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, progressive: true, mozjpeg: true })
        .toFile(diskPath);

      const thumbName = `work-${id}-thumb.jpg`;
      const thumbPath = path.join(store.WORKS_UPLOAD_DIR, thumbName);
      let thumbPipeline = sharp(file.buffer, { failOn: 'none' }).rotate();
      if (crop) thumbPipeline = thumbPipeline.extract(crop);
      await thumbPipeline
        .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 78, progressive: true, mozjpeg: true })
        .toFile(thumbPath);

      res.status(201).json({
        type: 'image',
        path: `/uploads/works/${filename}`,
        thumb: `/uploads/works/${thumbName}`,
      });
    } catch (e) {
      console.error('[upload] processing failed:', e.message);
      res.status(400).json({ error: 'Could not process file. Is it a valid image or video?' });
    }
  });
});

module.exports = router;
