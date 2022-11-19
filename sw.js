// Service worker
// Hopefully this does what it's supposed to and doesn't break

const levelVersion = "252f43d752deaa6417b65ac32c7823f16f0f6ab2";
const levelsBaseURL = `https://raw.githubusercontent.com/Flowit-Game/Levels/${levelVersion}`;
const name = `flowit-web-${levelVersion}`;

const pathsToCache = [
    "index.html",
    "main.js",
    "style.css",
    "texture.png",
    levelsBaseURL + "levelsEasy.xml",
    levelsBaseURL + "levelsMedium.xml",
    levelsBaseURL + "levelsHard.xml",
    levelsBaseURL + "levelsCommunity.xml",
];

self.addEventListener("install", e => {
    e.waitUntil(caches.keys().then(async keys => {
        for (let k of keys) {
            if (k !== name) {
                await caches.delete(k);
            }
        }
    }));

    e.waitUntil((async () => {
        const cache = await caches.open(name);
        await cache.addAll(pathsToCache);
    })());
});

self.addEventListener("fetch", event => {
    e.respondWith(caches.match(e.request).then(response => {
        return response || fetch(e.request);
    }));
});
