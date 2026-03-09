(function () {
    'use strict';

    const TYPE_OPTIONS = ['build', 'shop', 'pvp', 'farm'];
    const TYPE_TO_SET = {
        build: { id: '1', label: 'Dial (Build)' },
        farm: { id: '2', label: 'Farms' },
        shop: { id: '3', label: 'Dial (Shop)' },
        pvp: { id: '38', label: 'Dial (PVP Arena)' }
    };

    let editorActive = false;
    let markerData = null;
    let newEntries = [];
    let panelEl = null;
    let listEl = null;

    function buildDesc(entry, id) {
        const dialName = (entry.dialName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const dial = (entry.dial || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const info = (entry.info || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const wiki = (entry.wiki || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const x = String(entry.x ?? '');
        const y = String(entry.y ?? '');
        const z = String(entry.z ?? '');
        return '<div class="dial-box"><h1 class="dial-name">' + dialName + '</h1><div class="dial-bar"></div><p  class="dial-dial">/dial ' + dial + '</p><p  class="dial-info">' + info + '</p><p  class="dial-wiki"><a href="' + wiki + '">' + wiki + '</a></p><p  class="dial-coord">X : ' + x + ' Y : ' + y + ' Z : ' + z + '<br> ID : ' + id + ' Added by : Who?</p></div>';
    }

    function getNextMarkerId(data, setId) {
        const set = data.sets && data.sets[setId];
        const markers = set && set.markers ? set.markers : {};
        let max = 0;
        Object.keys(markers).forEach(function (k) {
            const n = parseInt(k, 10);
            if (!isNaN(n) && n > max) max = n;
        });
        return max + 1;
    }

    function entryToMarker(entry, id) {
        const typeToIcon = {
            build: 'building',
            farm: 'farm',
            shop: 'cart',
            pvp: 'pvp'
        };
        const markerIcon = typeToIcon[entry.type] || 'building';
        return {
            label: String(entry.dialName || ''),
            desc: buildDesc(entry, id),
            x: String(entry.x ?? ''),
            y: String(entry.y ?? ''),
            z: String(entry.z ?? ''),
            icon: markerIcon,
            info: String(entry.info || '')
        };
    }

    function renderNewEntriesList() {
        if (!listEl) return;
        listEl.innerHTML = '';
        newEntries.forEach(function (entry, i) {
            const li = document.createElement('li');
            li.style.marginBottom = '6px';
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.gap = '8px';
            li.textContent = '[' + entry.type + '] ' + (entry.dialName || 'Unnamed') + ' @ ' + entry.x + ', ' + entry.z;
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.textContent = 'Remove';
            rm.style.cssText = 'padding:4px 8px;background:#6a2a2a;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
            rm.addEventListener('click', function () {
                newEntries.splice(i, 1);
                renderNewEntriesList();
            });
            li.appendChild(rm);
            listEl.appendChild(li);
        });
    }

    function addEntry(form) {
        const entry = {
            dialName: (form.dialName && form.dialName.value) ? form.dialName.value.trim() : '',
            info: (form.info && form.info.value) ? form.info.value.trim() : '',
            x: (form.x && form.x.value) ? form.x.value.trim() : '',
            y: (form.y && form.y.value) ? form.y.value.trim() : '64',
            z: (form.z && form.z.value) ? form.z.value.trim() : '',
            type: (form.type && form.type.value) ? form.type.value : 'building',
            dial: (form.dial && form.dial.value) ? form.dial.value.trim() : '',
            wiki: (form.wiki && form.wiki.value) ? form.wiki.value.trim() : ''
        };
        newEntries.push(entry);
        renderNewEntriesList();
        if (form.dialName) form.dialName.value = '';
        if (form.info) form.info.value = '';
        if (form.x) form.x.value = '';
        if (form.y) form.y.value = '64';
        if (form.z) form.z.value = '';
        if (form.dial) form.dial.value = '';
        if (form.wiki) form.wiki.value = '';
    }

    function buildExportData() {
        const data = JSON.parse(JSON.stringify(markerData));
        if (!data.sets) data.sets = {};

        const nextIds = {};
        Object.keys(TYPE_TO_SET).forEach(function (type) {
            const target = TYPE_TO_SET[type];
            if (!data.sets[target.id]) {
                data.sets[target.id] = {
                    hide: false,
                    circles: {},
                    areas: {},
                    label: target.label,
                    lines: {},
                    layerprio: 1,
                    markers: {}
                };
            }
            nextIds[target.id] = getNextMarkerId(data, target.id);
        });

        newEntries.forEach(function (entry) {
            const target = TYPE_TO_SET[entry.type] || TYPE_TO_SET.building;
            const markers = data.sets[target.id].markers || {};
            const nextId = nextIds[target.id];
            markers[String(nextId)] = entryToMarker(entry, nextId);
            data.sets[target.id].markers = markers;
            nextIds[target.id] += 1;
        });

        return data;
    }

    function downloadJson() {
        if (!markerData) return;
        const data = buildExportData();
        const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'marker_world.json';
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function createPanel() {
        const wrap = document.createElement('div');
        wrap.id = 'editor-panel-wrap';
        wrap.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;';

        const panel = document.createElement('div');
        panel.id = 'editor-panel';
        panel.style.cssText = 'background:#2d2d2d;color:#eee;padding:20px;border-radius:12px;max-width:480px;width:90%;max-height:90vh;overflow:auto;box-shadow:0 8px 32px rgba(0,0,0,0.4);';

        panel.innerHTML =
            '<h2 style="margin-top:0;">Editor mode</h2>' +
            '<p style="color:#aaa;font-size:14px;">Add new markers (Build/Farms/Shop/PVP).</p>' +
            '<form id="editor-form">' +
            '<label>Dial name <input type="text" name="dialName" placeholder="Dial Name" style="width:100%;box-sizing:border-box;padding:6px;margin:4px 0;background:#1a1a1a;border:1px solid #555;color:#eee;border-radius:4px;"></label>' +
            '<label>Info <input type="text" name="info" placeholder="Short description / owners" style="width:100%;box-sizing:border-box;padding:6px;margin:4px 0;background:#1a1a1a;border:1px solid #555;color:#eee;border-radius:4px;"></label>' +
            '<label>X <input type="text" name="x" placeholder="0" style="width:100%;box-sizing:border-box;padding:6px;margin:4px 0;background:#1a1a1a;border:1px solid #555;color:#eee;border-radius:4px;"></label>' +
            '<label>Y <input type="text" name="y" placeholder="64" value="64" style="width:100%;box-sizing:border-box;padding:6px;margin:4px 0;background:#1a1a1a;border:1px solid #555;color:#eee;border-radius:4px;"></label>' +
            '<label>Z <input type="text" name="z" placeholder="0" style="width:100%;box-sizing:border-box;padding:6px;margin:4px 0;background:#1a1a1a;border:1px solid #555;color:#eee;border-radius:4px;"></label>' +
            '<label>Dial command <input type="text" name="dial" value="" placeholder="" style="width:100%;box-sizing:border-box;padding:6px;margin:4px 0;background:#1a1a1a;border:1px solid #555;color:#eee;border-radius:4px;"></label>' +
            '<label>Wiki URL <input type="text" name="wiki" placeholder="https://..." style="width:100%;box-sizing:border-box;padding:6px;margin:4px 0;background:#1a1a1a;border:1px solid #555;color:#eee;border-radius:4px;"></label>' +
            '<label>Type <select name="type" style="width:100%;box-sizing:border-box;padding:6px;margin:4px 0;background:#1a1a1a;border:1px solid #555;color:#eee;border-radius:4px;">' +
            TYPE_OPTIONS.map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join('') +
            '</select></label>' +
            '<button type="button" id="editor-add-btn" style="margin-top:8px;padding:8px 16px;background:#4a7c59;color:#fff;border:none;border-radius:6px;cursor:pointer;">Add entry</button>' +
            '</form>' +
            '<h3 style="margin-top:20px;">New entries (' + '<span id="editor-count">0</span>' + ')</h3>' +
            '<ul id="editor-entries-list" style="list-style:none;padding:0;margin:0;"></ul>' +
            '<div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">' +
            '<button type="button" id="editor-download-btn" style="padding:10px 20px;background:#3d6ba8;color:#fff;border:none;border-radius:6px;cursor:pointer;">Download marker_world.json</button>' +
            '<button type="button" id="editor-close-btn" style="padding:10px 20px;background:#555;color:#fff;border:none;border-radius:6px;cursor:pointer;">Exit editor</button>' +
            '</div>';

        wrap.appendChild(panel);
        document.body.appendChild(wrap);
        panelEl = wrap;
        listEl = document.getElementById('editor-entries-list');

        document.getElementById('editor-form').addEventListener('submit', function (e) {
            e.preventDefault();
            addEntry(e.target);
        });
        document.getElementById('editor-add-btn').addEventListener('click', function () {
            addEntry(document.getElementById('editor-form'));
        });
        document.getElementById('editor-download-btn').addEventListener('click', downloadJson);
        document.getElementById('editor-close-btn').addEventListener('click', closeEditor);
        wrap.addEventListener('click', function (e) {
            if (e.target === wrap) closeEditor();
        });

        function updateCount() {
            var el = document.getElementById('editor-count');
            if (el) el.textContent = newEntries.length;
        }
        var origRender = renderNewEntriesList;
        renderNewEntriesList = function () {
            origRender();
            updateCount();
        };
        updateCount();
    }

    function closeEditor() {
        if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl);
        panelEl = null;
        listEl = null;
        editorActive = false;
        var btn = document.getElementById('editor-toggle-btn');
        if (btn) btn.textContent = 'Editor';
    }

    function openEditor() {
        if (editorActive) {
            closeEditor();
            return;
        }
        editorActive = true;
        var btn = document.getElementById('editor-toggle-btn');
        if (btn) btn.textContent = 'Close editor';

        fetch('data/marker_world.json')
            .then(function (r) {
                if (!r.ok) throw new Error('Failed to load marker_world.json');
                return r.json();
            })
            .then(function (data) {
                markerData = data;
                newEntries = [];
                createPanel();
            })
            .catch(function (err) {
                console.error(err);
                alert('Could not load marker data. Ensure you are serving the site (e.g. from a local server) so data/marker_world.json can be fetched.');
                editorActive = false;
                if (btn) btn.textContent = 'Editor';
            });
    }

    function addToggleButton() {
        var btn = document.createElement('button');
        btn.id = 'editor-toggle-btn';
        btn.textContent = 'Editor';
        btn.addEventListener('click', openEditor);
        document.body.appendChild(btn);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addToggleButton);
    } else {
        addToggleButton();
    }
})();
