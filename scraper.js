#!/usr/bin/env node
/**
 * scraper.js — Dataset builder using Unsplash API (open-source, free tier)
 *
 * Fetches labeled interior room images and saves a dataset manifest JSON.
 * Run: node scraper.js
 *
 * Requirements:
 *   npm install node-fetch@2 fs-extra
 *
 * Unsplash free API: https://unsplash.com/developers
 * Register at https://unsplash.com/oauth/applications to get a free access key.
 * Free tier: 50 requests/hour, no auth required for demo key.
 *
 * The dataset manifest (dataset/manifest.json) is consumed by train.py.
 */

const fetch  = require('node-fetch');
const fs     = require('fs-extra');
const path   = require('path');
const https  = require('https');
const http   = require('http');

// ── Config ────────────────────────────────────────────────────────────────────
// Replace with your Unsplash Access Key from https://unsplash.com/oauth/applications
// For demo/testing the public demo key works at low rate limits
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_KEY || 'YOUR_UNSPLASH_ACCESS_KEY';
const BASE_URL  = 'https://api.unsplash.com';
const OUT_DIR   = path.join(__dirname, 'dataset');
const IMG_DIR   = path.join(OUT_DIR, 'images');
const PER_CLASS = 30;   // images per (room_type × style) class — increase for better accuracy
const DELAY_MS  = 1200; // stay well under 50 req/hour rate limit

// ── Label map ─────────────────────────────────────────────────────────────────
// Each entry: { label, query }
// label format: "roomType_style"  (matches AI_IMAGE_MAP keys in app.js)
const CLASSES = [
    { label: 'living_modern',      query: 'modern living room interior' },
    { label: 'living_minimal',     query: 'minimalist living room interior' },
    { label: 'living_traditional', query: 'traditional living room interior' },
    { label: 'living_luxury',      query: 'luxury living room interior' },
    { label: 'bedroom_modern',     query: 'modern bedroom interior design' },
    { label: 'bedroom_minimal',    query: 'minimalist bedroom interior' },
    { label: 'bedroom_traditional',query: 'traditional bedroom interior' },
    { label: 'bedroom_luxury',     query: 'luxury bedroom interior design' },
    { label: 'kitchen_modern',     query: 'modern kitchen interior design' },
    { label: 'kitchen_minimal',    query: 'minimalist kitchen interior' },
    { label: 'kitchen_traditional',query: 'traditional kitchen interior' },
    { label: 'kitchen_luxury',     query: 'luxury kitchen interior design' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : http;
        const file  = fs.createWriteStream(dest);
        proto.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                file.close();
                return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function fetchUnsplashPage(query, page = 1) {
    const url = `${BASE_URL}/search/photos?query=${encodeURIComponent(query)}&per_page=30&page=${page}&orientation=landscape`;
    const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
    });
    if (!res.ok) throw new Error(`Unsplash API error ${res.status}: ${await res.text()}`);
    return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    await fs.ensureDir(IMG_DIR);

    const manifest = [];   // { filePath, label, width, height, unsplashId }
    let totalDownloaded = 0;

    for (const cls of CLASSES) {
        console.log(`\n[${cls.label}] Fetching "${cls.query}"…`);
        const classDir = path.join(IMG_DIR, cls.label);
        await fs.ensureDir(classDir);

        let collected = 0;
        let page = 1;

        while (collected < PER_CLASS) {
            let data;
            try {
                data = await fetchUnsplashPage(cls.query, page);
            } catch (e) {
                console.error(`  API error: ${e.message}`);
                break;
            }

            const photos = data.results || [];
            if (!photos.length) break;

            for (const photo of photos) {
                if (collected >= PER_CLASS) break;

                // Use small (400px) thumb for fast training — enough for MobileNet 224×224
                const imgUrl  = photo.urls.small;
                const imgFile = path.join(classDir, `${photo.id}.jpg`);
                const relPath = path.relative(__dirname, imgFile);

                if (!await fs.pathExists(imgFile)) {
                    try {
                        await downloadFile(imgUrl, imgFile);
                        process.stdout.write('.');
                    } catch (e) {
                        process.stdout.write('x');
                        continue;
                    }
                } else {
                    process.stdout.write('s'); // skipped (already exists)
                }

                manifest.push({
                    filePath: relPath.replace(/\\/g, '/'),
                    label:    cls.label,
                    width:    photo.width,
                    height:   photo.height,
                    unsplashId: photo.id
                });
                collected++;
                totalDownloaded++;
            }

            page++;
            await sleep(DELAY_MS);
        }

        console.log(`\n  → ${collected} images for [${cls.label}]`);
    }

    // Write manifest
    const manifestPath = path.join(OUT_DIR, 'manifest.json');
    await fs.writeJson(manifestPath, {
        classes:   CLASSES.map(c => c.label),
        numClasses: CLASSES.length,
        total:     manifest.length,
        perClass:  PER_CLASS,
        items:     manifest
    }, { spaces: 2 });

    console.log(`\n✓ Done. ${totalDownloaded} images saved.`);
    console.log(`✓ Manifest written to ${manifestPath}`);
    console.log('\nNext step: python train.py');
}

main().catch(err => { console.error(err); process.exit(1); });
