//
// Unofficial web port of Flowit
//
// Copyright © 2022 by luk3yx
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

'use strict';

const colours = new Set("rgbod0");

function updateCell(cell) {
    cell.elem.setAttribute("data-colour", cell.colour);
    cell.elem.setAttribute("data-modifier", cell.modifier);
}

function sleep(ms) {
    return new Promise((resolve, reject) => {
        window.setTimeout(() => resolve(), ms);
    });
}

const cardinalDirs = [{x: -1, y: 0}, {x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}];
let mainMenu, packSelector, levelSelector, gameScreen, currentLevel;

function loadScores(path) {
    return JSON.parse(localStorage.getItem(`scores-${path}`)) || {};
}

function saveScores(path, scores) {
    localStorage.setItem(`scores-${path}`, JSON.stringify(scores));
}

class Level {
    constructor(path, idx, number, color, modifier, author) {
        this.path = path;
        this.idx = idx;
        this.moves = 0;
        this.number = number;
        this.author = author;

        color = color.replace(/\s/g, "");
        modifier = modifier.replace(/\s/g, "");

        let width = 5, height = 6;
        if (color.length === 6 * 8 && modifier.length === 6 * 8) {
            width = 6; height = 8;
        }

        this.grid = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                row.push({
                    colour: color[x + y * width],
                    modifier: modifier[x + y * width],
                });
            }
            this.grid.push(row);
        }

        this.updating = false;
    }

    get width() {
        return this.height > 0 ? this.grid[0].length : 0;
    }

    get height() {
        return this.grid.length;
    }

    isCompleted() {
        for (let row of this.grid) {
            for (let cell of row) {
                if (colours.has(cell.colour) && colours.has(cell.modifier) &&
                        cell.colour !== cell.modifier)
                    return false;
            }
        }
        return true;
    }

    createGame() {
        const elem = document.createElement("div");
        elem.className = "game";
        const width = Math.floor(100 / (this.width + 0.5));
        const height = Math.floor(100 / (this.height + 0.5));
        elem.style.setProperty("--size", `min(96px, ${width}vw, ${height}vh ` +
                               `- (var(--navbar-height) / ${this.height}))`);
        elem.style.setProperty("--cols", this.width);
        elem.style.width = `calc(${this.width} * var(--size))`;
        elem.style.height = `calc(${this.height} * var(--size))`;

        for (let y = 0; y < this.height; y++) {
            const row = this.grid[y];
            for (let x = 0; x < this.width; x++) {
                const cell = row[x];
                const ce = document.createElement("button");
                ce.className = "cell";
                ce.setAttribute("data-colour", cell.colour);
                ce.setAttribute("data-modifier", cell.modifier);
                ce.setAttribute("tabindex", "0");
                ce.addEventListener("click", () => this.activateCell(x, y, cell));
                cell.elem = ce;
                updateCell(cell);
                elem.appendChild(ce);
            }
        }

        this.elem = elem;
        return elem;
    }

    go() {
        document.getElementById("levelCompleted").classList.remove("shown");

        const level = this.copy();
        const gameWrapper = document.getElementById("game-wrapper");
        gameWrapper.innerHTML = "";
        gameWrapper.appendChild(level.createGame());
        level.moveCounterSpan = document.getElementById("moves");
        level.moveCounterSpan.textContent = this.moves;

        const scores = loadScores(this.path);
        const bestScore = document.getElementById("best-score");
        bestScore.textContent = scores[this.number] || "-";

        const completedIcon = document.getElementById("completed-icon");
        if (scores[this.number])
            completedIcon.classList.add("completed");
        else
            completedIcon.classList.remove("completed");

        setActiveScreen(gameScreen);
        currentLevel = level;
    }

    async activateCell(x, y, cell) {
        if (this.updating)
            return;
        this.updating = true;

        let p;
        switch (cell.modifier) {
            case "R":
                p = this.directionToggle(x, y, 1, 0, cell.colour);
                break;
            case "U":
                p = this.directionToggle(x, y, 0, -1, cell.colour);
                break;
            case "L":
                p = this.directionToggle(x, y, -1, 0, cell.colour);
                break;
            case "D":
                p = this.directionToggle(x, y, 0, 1, cell.colour);
                break;
            case "B":
                p = this.bomb(x, y, cell.colour);
                break;
            case "F":
                p = this.flood(x, y, cell.colour);
                break;
            case "x": // Right
                p = this.directionToggleAndRotate(x, y, 1, 0, cell, "s");
                break;
            case "w": // Up
                p = this.directionToggleAndRotate(x, y, 0, -1, cell, "x");
                break;
            case "a": // Left
                p = this.directionToggleAndRotate(x, y, -1, 0, cell, "w");
                break;
            case "s": // Down
                p = this.directionToggleAndRotate(x, y, 0, 1, cell, "a");
                break;
        }

        if (p) {
            this.moves++;
            if (this.moveCounterSpan)
                this.moveCounterSpan.textContent = this.moves;
            await p;
            if (this.isCompleted()) {
                this.onComplete();
            }
        }

        this.updating = false;
    }

    validPos(x, y) {
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    async directionToggleAndRotate(x, y, dx, dy, cell, newModifier) {
        cell.modifier = newModifier;
        updateCell(cell);
        await this.directionToggle(x, y, dx, dy, cell.colour);
    }

    async directionToggle(x, y, dx, dy, colour) {
        x += dx;
        y += dy;
        if (this.validPos(x, y)) {
            if (this.grid[y][x].modifier === colour)
                await this.directionReplace(x, y, dx, dy, colour, "0");
            else
                await this.directionReplace(x, y, dx, dy, "0", colour);
        }
    }

    async directionReplace(x, y, dx, dy, old, newMod) {
        while (this.validPos(x, y) && this.grid[y][x].modifier === old) {
            this.grid[y][x].modifier = newMod;
            updateCell(this.grid[y][x]);
            await sleep(40);
            x += dx;
            y += dy;
        }
    }

    bombOne(x, y, colour) {
        if (this.validPos(x, y)) {
            const cell = this.grid[y][x];
            if (cell.modifier !== "X") {
                cell.modifier = colour;
                updateCell(cell);
            }
        }
    }

    async bomb(x, y, colour) {
        this.bombOne(x, y, colour);
        await sleep(100);
        for (let d of cardinalDirs)
            this.bombOne(x + d.x, y + d.y, colour);
        await sleep(100);
        for (let dx = -1; dx <= 1; dx += 2)
            for (let dy = -1; dy <= 1; dy += 2)
                this.bombOne(x + dx, y + dy, colour);
    }

    async flood(x, y, colour) {
        for (let d of cardinalDirs) {
            const x2 = x + d.x, y2 = y + d.y;
            if (this.validPos(x2, y2) && this.grid[y2][x2].modifier === "0") {
                await this.floodInner(x, y, "0", colour);
                return;
            }
        }
        await this.floodInner(x, y, colour, "0");
    }

    async floodInner(x, y, old, newMod) {
        let flooding = true;
        let positions = [{x: x, y: y}];
        while (positions.length > 0) {
            let lastPositions = positions;
            positions = [];
            for (let pos of lastPositions) {
                for (let d of cardinalDirs) {
                    const x2 = pos.x + d.x, y2 = pos.y + d.y;
                    if (this.validPos(x2, y2) && this.grid[y2][x2].modifier === old) {
                        flooding = true;
                        this.grid[y2][x2].modifier = newMod;
                        updateCell(this.grid[y2][x2]);
                        positions.push({x: x2, y: y2});
                    }
                }
            }
            await sleep(60);
        }
    }

    onComplete() {
        const scores = loadScores(this.path);
        if (!scores[this.number] || this.moves < scores[this.number]) {
            scores[this.number] = this.moves;
            saveScores(this.path, scores);
            document.getElementById("best-score").textContent = this.moves;
            document.getElementById("completed-icon").classList.add("completed");
        }

        document.getElementById("levelCompleted").classList.add("shown");
    }

    async returnToLevelSelector() {
        await loadLevelList(this.path);
    }

    copy() {
        return Object.assign(Object.create(Level.prototype),
            window.structuredClone ? structuredClone(this) :
                JSON.parse(JSON.stringify(this)));
    }

    reset() {
        return levelsCache[this.path][this.idx].go();
    }

    previous() {
        return levelsCache[this.path][this.idx - 1];
    }

    next() {
        return levelsCache[this.path][this.idx + 1];
    }
}

// function downloadLevels(path) {
//     return new Promise((resolve, reject) => {
//         const req = new XMLHttpRequest();
//         req.addEventListener("load", () => {
//             if (req.status !== 200 || !req.responseXML)
//                 reject(`Failed to load ${path}: ${req.status} ${req.statusText}`);
//
//             const levels = [];
//             for (let level of req.responseXML.getElementsByTagName("level")) {
//                 levels.push(new Level(
//                     path,
//                     levels.length,
//                     level.getAttribute("number"),
//                     level.getAttribute("color"),
//                     level.getAttribute("modifier"),
//                     level.getAttribute("author"),
//                 ));
//             }
//             resolve(levels);
//         });
//         req.open("GET", path);
//         req.send();
//     });
// }

async function downloadLevels(path) {
    // Remember to update the baseurl in sw.js as well!
    const res = await fetch("https://raw.githubusercontent.com/Flowit-Game/Flowit/v3.3/app/src/main/assets/" + path);
    const parser = new DOMParser();
    const xml = parser.parseFromString(await res.text(), "text/xml");

    const levels = [];
    for (let level of xml.getElementsByTagName("level")) {
        levels.push(new Level(
            path,
            levels.length,
            level.getAttribute("number"),
            level.getAttribute("color"),
            level.getAttribute("modifier"),
            level.getAttribute("author"),
        ));
    }
    return levels;
}

function setActiveScreen(screen) {
    for (let elem of document.querySelectorAll(".screen.active"))
        elem.classList.remove("active");
    screen.classList.add("active");

    mainMenu.style.display = mainMenu.contains(screen) ? "" : "none";
}

const levelsCache = {};
async function loadLevelList(path) {
    if (!levelsCache[path])
        levelsCache[path] = await downloadLevels(path);
    const levels = levelsCache[path];
    const scores = JSON.parse(localStorage.getItem(`scores-${path}`)) || {};

    levelSelector.innerHTML = "";
    let seqNum = 0;
    let lockIn = 7;
    for (let level of levels) {
        const btn = document.createElement("div");
        btn.setAttribute("tabindex", "0");
        btn.classList.add("level-btn");
        lockIn--;
        if (scores[level.number]) {
            btn.classList.add("completed");
            lockIn = 6;
        } else if (lockIn <= 0) {
            btn.classList.add("locked");
        }
        btn.addEventListener("click", () => level.go());

        seqNum++;
        btn.textContent = seqNum;
        levelSelector.appendChild(btn);
    }

    setActiveScreen(levelSelector);
}

window.addEventListener("load", () => {
    mainMenu = document.getElementById("main-menu");
    packSelector = document.getElementById("select-pack");
    levelSelector = document.getElementById("select-level");
    gameScreen = document.getElementById("game-screen");
});

window.addEventListener("error", e => {
    alert(e.message);
});

// Service workers
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}

// Add an option to remove the service workers because I don't trust them to
// not break
async function unregisterServiceWorkersAndReload() {
    document.body.style.display = "flex";
    document.body.style.alignItems = "center";
    document.body.style.justifyContent = "center";

    if ('serviceWorker' in navigator) {
        document.body.textContent = "Getting service worker registrations...";
        const registrations = await navigator.serviceWorker.getRegistrations();

        document.body.textContent = "Unregistering service workers...";
        for (let registration of registrations)
            await registration.unregister();
    }

    if ('caches' in window) {
        document.body.textContent = "Fetching cache keys...";
        const keys = await caches.keys();

        document.body.textContent = "Clearing cache...";
        for (let key of keys)
            await caches.delete(key);
    }

    document.body.textContent = "Refreshing page...";
    window.location.reload();
}
