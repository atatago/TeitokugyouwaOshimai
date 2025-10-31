// content.js
class GameData {
    constructor() {
        if (GameData.instance) {
            return GameData.instance;
        }
        GameData.instance = this;
    }
    masterData = null;
    currentDeckData = [];
    currentShipData = [];
    currentNyukyoData = [];
    battleDeckData = [];
    countdownInterval = null;
    isBattle = false;
    isBossBattle = false;
}

// --- 1. XHR/Fetchフック用スクリプトの注入 (全フレームで実行) ---
const script = document.createElement('script');
script.src = chrome.runtime.getURL('xhr_hook_injector.js');
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// --- 3. UIセットアップとDOMロード待機 ---
function setupDisplayArea() {
    return new Promise(resolve => {
        const mainDisplayId = 'kancolle-info-display';

        // bodyが存在しない場合は、DOMContentLoadedを待つ
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', () => resolve(setupDisplayArea()), { once: true });
            return;
        }

        // 既にUIがセットアップ済みかチェック
        if (document.getElementById(mainDisplayId)) {
            startCountdown();
            return resolve();
        }

        console.log('[Content Script] Setting up UI Display Area.');

        const displayArea = document.createElement('div');
        displayArea.id = mainDisplayId;

        // Canvasの相対位置を計算
        const gameFrame = document.querySelector('iframe[id="game_frame"]');
        let topPosition = '10px';
        let rightPosition = '10px';

        displayArea.style.cssText = `
            position: fixed; /* スクロール追従のために固定 */
            background-color:rgba(0,0,0,0.8); 
            color:white; 
            padding:15px; 
            border-radius:8px; 
            font-size:16px; 
            width: 1200px; /* ゲーム画面の幅に合わせる */
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            text-align: left;
            z-index: 9999; /* 最前面に表示 */
            inset: 0;
            top: 821px; /* 仮の初期位置 */
            margin: auto;
        `;

        displayArea.innerHTML = `
            <style>
                .float-box {
                    float: left;
                }
                .flex-box {
                    display: flex;
                }
                .display-box {
                    padding: 0.1em;
                    margin-bottom: 0.5em;
                }
                .simple-list{
                    list-style: none;
                    padding-left: 1em;
                    margin: 0;
                }
                .quest-title { /* 任務 */
                    font-size: smaller;
                }
                .quest-progress50 {
                    background-color: #1ddd1d;
                    padding: 0 0.2em;
                }
                .quest-progress80 {
                    background-color: #1d991d;
                    padding: 0 0.2em;
                }
                .quest-complete {
                    background-color: #00bfff;
                    padding: 0 0.2em;
                }
                .deck-box { /* 艦隊ボックス */
                    width: 14em;
                    margin-right: 0.3em;
                }
                .ship-box { /* 艦ボックス */
                    border: 0.1em solid #555;
                    padding: 0.3em;
                    margin-bottom: 0.2em;
                    border-radius: 0.2em;
                }
                .ship-info { /* 艦情報 */
                    display: flex;
                    font-weight: bold;
                    margin-bottom: 0.1em;
                    color: #fff;
                }
                .deck-battle{
                    background-color: #ff0000;
                    padding: 0 0.2em;
                }
                .deck-mission{
                    background-color: #00bfff;
                    padding: 0 0.2em;
                }
                .deck-charge{
                    background-color: #D2691E;
                    padding: 0 0.2em;
                }
                .ship-name { /* 艦名 */
                    width: 16em;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .ship-cond { /* コンディション */
                    display: inline-block;
                    font-size: medium;
                    width: 5em;
                }
                .ship-lv {
                    display: inline-block;
                    font-size: small;
                    margin-right: auto;
                }
                .ship-hp {
                    display: inline-block;
                    font-size: smaller;
                }
                .ship-hp-bar-box {
                    height: 0.3em;
                    background-color: #333;
                    border-radius: 0.2em;
                }
                .ship-hp-bar {
                    height: 100%;
                    border-radius: 0.2em;
                }
            </style>

            <div style="display: flex;">
                <div id="display-fleet-info" class="display-box float-box">
                    <div><strong>🚢 編成:</strong></div>
                    <div id="fleet-info-list">
                        <li>データ受信待ち...</li>
                    </div>
                </div>
                
                <div class="float-box">
                    <div id="display-mission" class="display-box">
                        <div><strong>🗺️ 遠征艦隊:</strong></div>
                        <ul id="mission-list" class="simple-list">
                            <li>データ受信待ち...</li>
                        </ul>
                    </div>

                    <div id="display-nyukyo" class="display-box">
                        <div><strong>🛠️ 入渠ドック:</strong></div>
                        <ul id="nyukyo-list" class="simple-list">
                            <li>データ受信待ち...</li>
                        </ul>
                    </div>

                    <div id="quest-box" class="display-box">
                        <div><strong>📋 任務:</strong></div>
                        <ul id="quest-list" class="simple-list">
                            <li>データ受信待ち...</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(displayArea);

        window.addEventListener('scroll', updateDisplayPosition);
        window.addEventListener('resize', updateDisplayPosition);

        // 子要素 (nyukyo-list) の存在をポーリングで保証する
        const checkChildElements = () => {
            if (document.getElementById('nyukyo-list')) {
                console.log('[Content Script] UI fully rendered. Starting countdown.');
                startCountdown();
                resolve(); // 子要素が見つかったら解決
            } else {
                setTimeout(checkChildElements, 25);
            }
        };
        checkChildElements();
    });
}

// --- 4. リアルタイムカウントダウンの処理 ---
function startCountdown() {
    const gameData = new GameData();
    if (gameData.countdownInterval) clearInterval(gameData.countdownInterval);

    gameData.countdownInterval = setInterval(() => {
        // UIがレンダリングされているか確認してから更新
        if (document.getElementById('nyukyo-list')) {
            if (gameData.currentNyukyoData.length > 0) updateNyukyoUI(gameData.currentNyukyoData, gameData.currentShipData, gameData.masterData);
            if (gameData.currentDeckData.length > 0) updateMissionUI(gameData.currentDeckData);
        }
    }, 1000);
}

/**
 * 表示位置更新
 * @returns 
 */
function updateDisplayPosition() {
    const displayArea = document.getElementById('kancolle-info-display');
    const gameFrame = document.querySelector('iframe[id="game_frame"]');

    if (!displayArea || !gameFrame) return;

    // ゲーム画面の四角形情報を取得 (ビューポートからの相対位置)
    const rect = gameFrame.getBoundingClientRect();

    // 画面下端からの距離を計算
    let topPosition = rect.bottom - 125;

    // 画面上端にUIが隠れるのを防ぐ処理
    if (topPosition < 10) {
        topPosition = 10; // 画面上端に固定
    }

    // CSSを適用
    displayArea.style.top = `${topPosition}px`;
}

// 全フレームで実行されるメッセージリスナー ---
// データ通信を行っているformは別オリジンなのでChromeの通信機能を使ってデータ送信する
window.addEventListener("message", (event) => {
    // 自身のフックコードからのデータか確認
    if (event.source !== window || !event.data || event.data.type !== "KANCOLLE_API_DATA") {
        return;
    }

    // 拡張機能の通信路を使って、親フレームへデータを転送
    const dataToTransfer = {
        action: "API_DATA_RECEIVED",
        data: event.data,
        requestBody: event.requestBody
    };

    chrome.runtime.sendMessage(dataToTransfer);
});

// chrome.runtime.onMessage リスナー ---
if (window.top === window) {
    // UIセットアップと初期化...
    setupDisplayArea();
    let port = null;

    // chrome.runtimeからのメッセージを受信
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "API_DATA_RECEIVED") {
            const apiData = request.data;
            const gameData = new GameData();

            // UIの存在を待ってからデータ処理
            setupDisplayArea().then(() => {
                switch (apiData.path) {
                    case 'api_start2/get_option_setting':
                        updateDisplayPosition();
                        break;

                    case 'api_start2/getData':
                        // マスターデータ取得
                        gameData.masterData = apiData.data.api_data;
                        break;

                    case 'api_port/port':
                        // 艦隊情報取得
                        port = apiData.data;

                        gameData.currentDeckData = port.api_data.api_deck_port;          //艦隊情報
                        gameData.currentShipData = port.api_data.api_ship;               //艦情報
                        gameData.currentNyukyoData = port.api_data.api_ndock;            //入渠情報

                        updateFleetInfoUI(gameData.currentDeckData, gameData.currentShipData, gameData.masterData);
                        updateNyukyoUI(gameData.currentNyukyoData, gameData.currentShipData, gameData.masterData);
                        updateMissionUI(gameData.currentDeckData);
                        break;

                    case 'api_req_hensei/change':
                        // 編成変更
                        henseiChange(port, apiData);
                        updateFleetInfoUI(port.api_data.api_deck_port, port.api_data.api_ship, gameData.masterData);
                        break;

                    case 'api_req_hensei/preset_select':
                        // プリセット展開
                        const deckIndex = port.api_data.api_deck_port.findIndex(r => r.api_id === apiData.data.api_data.api_id);
                        port.api_data.api_deck_port[deckIndex].api_ship = apiData.data.api_data.api_ship;
                        updateFleetInfoUI(port.api_data.api_deck_port, port.api_data.api_ship, gameData.masterData);
                        break;

                    case 'api_get_member/deck':
                        //遠征
                        gameData.currentDeckData = apiData.data.api_data;
                        updateFleetInfoUI(gameData.currentDeckData, gameData.currentShipData, gameData.masterData);
                        updateMissionUI(gameData.currentDeckData);
                        break;

                    case 'api_req_map/start':
                        //戦闘
                        const bp = paramToDict(apiData.requestBody);
                        const deckId = parseInt(bp['api_deck_id']);

                        gameData.isBattle = true;
                        gameData.isBossBattle = false;
                        //ship_deck のレスポンス形式に合わせて currentDeckData を作る
                        gameData.currentDeckData.filter(r => r.api_id === deckId).map(r => {
                            r.isBattle = gameData.isBattle;
                            r.isBossBattle = gameData.isBossBattle;
                        });

                        gameData.battleDeckData = {
                            "api_deck_data": gameData.currentDeckData,
                            "api_ship_data": gameData.currentShipData,
                        };
                        updateBattleResultUI(gameData.battleDeckData, gameData.masterData);
                        break;

                    case 'api_req_sortie/battle':
                        //戦闘
                        //updateBattleResultUI(gameData.battleDeckData, gameData.masterData);
                        break;

                    case 'api_get_member/ship_deck':
                        //戦闘
                        gameData.battleDeckData = apiData.data.api_data;
                        gameData.battleDeckData.api_deck_data.map(r => {
                            r.isBattle = gameData.isBattle;
                            r.isBossBattle = gameData.isBossBattle;
                        });
                        updateBattleResultUI(gameData.battleDeckData, gameData.masterData);
                        break;

                    case 'api_req_map/next':
                        //戦闘
                        if (apiData.data.api_data.api_bosscell_no === apiData.data.api_data.api_no) {
                            gameData.isBattle = true;
                            gameData.isBossBattle = true;
                        } else {
                            gameData.isBattle = true;
                            gameData.isBossBattle = false;
                        }

                        gameData.battleDeckData.api_deck_data.filter(r => r.isBattle !== undefined).map(r => {
                            r.isBattle = gameData.isBattle;
                            r.isBossBattle = gameData.isBossBattle;
                        });
                        updateBattleResultUI(gameData.battleDeckData, gameData.masterData);
                        break;

                    case 'api_get_member/questlist':
                        //任務
                        updateQuestList(apiData);
                        break;

                    case 'api_get_member/ndock':
                        //入渠
                        gameData.currentNyukyoData = apiData.data.api_data;
                        updateNyukyoUI(gameData.currentNyukyoData, gameData.currentShipData, gameData.masterData);
                        break;

                    case 'api_req_nyukyo/start':
                        //入渠
                        const p = paramToDict(apiData.requestBody);
                        if (p['api_highspeed'] === '1') {
                            //バケツ使用
                            const s = port.api_data.api_ship.filter(r => r.api_id === parseInt(p['api_ship_id']))[0];
                            s.api_nowhp = s.api_maxhp;
                            updateFleetInfoUI(port.api_data.api_deck_port, port.api_data.api_ship, gameData.masterData);
                        }
                        break;

                    case 'api_req_hokyu/charge':
                        //補給
                        apiData.data.api_data.api_ship.forEach(charge => {
                            const s = port.api_data.api_ship.filter(r => r.api_id === charge.api_id)[0];
                            s.api_bull = charge.api_bull;
                            s.api_fuel = charge.api_fuel;
                        });
                        updateFleetInfoUI(port.api_data.api_deck_port, port.api_data.api_ship, gameData.masterData);
                        break;
                }
            });
        }
    });
}

/**
 * 入渠表示更新
 * 通知が必要なので content.js に実装
 * @param {*} ndocks 
 * @returns 
 */
function updateNyukyoUI(ndocks, ships, masterData) {
    const listElement = document.getElementById('nyukyo-list');
    if (!listElement) return;
    //console.info("nDock : " + JSON.stringify(ndocks));

    const currentTime = Date.now();
    let html = '';

    ndocks.forEach(dock => {
        switch (dock.api_state) {
            case 0:
                html += `<li>[${dock.api_id} : --:--:--] : </li>`;
                break;
            case 1:
            case 2:
                const completeTimeMs = dock.api_complete_time;
                const remainingSeconds = Math.max(0, Math.floor((completeTimeMs - currentTime) / 1000));
                const remainingTimeStr = formatRemainingTime(remainingSeconds);
                const ship = ships.filter(r => r.api_id === dock.api_ship_id)[0];
                const name = masterData.api_mst_ship.filter(s => s.api_id === ship.api_ship_id)[0].api_name;

                if (remainingSeconds === 0) {
                    html += `<li style="color: #4CAF50;">[${dock.api_id} : ✅ 完了！] : ${name}</li>`;
                } else {
                    html += `<li>[${dock.api_id} : ${remainingTimeStr}] : ${name}</li>`;
                }
                break;
        }
    });
    listElement.innerHTML = html;
}

/**
 * 遠征表示更新
 * 通知が必要なので content.js に実装
 * @param {*} decks 
 * @returns 
 */
function updateMissionUI(decks) {
    const listElement = document.getElementById('mission-list');
    if (!listElement) return;
    if (!decks) return;

    //console.info("decks : " + JSON.stringify(decks));
    let html = '';
    decks.filter(r => r.api_id > 1).forEach(deck => {
        //console.info("exp : " + JSON.stringify(deck));
        if (deck.api_mission[0] === 1) {
            const completeTimeMs = deck.api_mission[2];
            const currentTime = Date.now();
            const remainingSeconds = Math.max(0, Math.floor((completeTimeMs - currentTime) / 1000));

            const remainingTimeStr = formatRemainingTime(remainingSeconds);

            if (remainingSeconds < 60) {
                if (deck.api_mission[3] !== 1) {
                    const title = `🚨 遠征完了 (${deck.api_id})`;
                    const message = `第${deck.api_id}艦隊（${deck.api_name}）の遠征が完了しました。`;
                    sendMessage(title, message);
                    deck.api_mission[3] = 1;
                }
                html += `<li style="color: #4CAF50;">[${deck.api_id} : --:--:--]: ✅ 帰投！</li>`;
            } else {
                html += `<li>[${deck.api_id} : ${remainingTimeStr}] : ⏳ ${deck.api_name}</li>`;
            }
        } else {
            deck.api_mission[3] = 0;    //通知フラグ
            html += `<li>[${deck.api_id} : --:--:--] : </li>`;
        }
    });

    listElement.innerHTML = html;
}

/**
 * メッセージ送信
 * @param {*} t 
 * @param {*} m 
 */
function sendMessage(t, m) {
    chrome.runtime.sendMessage({ action: "SEND_NOTIFICATION", title: t, message: m, });
}

/**
 * 編成変更
 * @param {*} port 
 * @param {*} apiData 
 */
function henseiChange(port, apiData) {
    const param = paramToDict(apiData.requestBody);
    const shipIndex = parseInt(param['api_ship_idx']);
    const selectedShipId = parseInt(param['api_ship_id']);
    const targetDeckNo = parseInt(param['api_id']);

    const targetDeck = port.api_data.api_deck_port.filter(r => r.api_id === targetDeckNo)[0];
    if (param['api_ship_id'] === '-2') {
        // 一括解除
        targetDeck.api_ship = [targetDeck.api_ship[0], -1, -1, -1, -1, -1];
    } else if (param['api_ship_id'] === '-1') {
        // 解除
        targetDeck.api_ship.splice(shipIndex, 1);
        targetDeck.api_ship.push(-1);
    } else {
        const oldIndex = targetDeck.api_ship.indexOf(selectedShipId);
        if (oldIndex === -1) {
            // 選択
            targetDeck.api_ship[shipIndex] = selectedShipId;
        } else {
            // 入れ替え
            const swapShipId = targetDeck.api_ship[shipIndex];
            targetDeck.api_ship[shipIndex] = selectedShipId;
            targetDeck.api_ship[oldIndex] = swapShipId;
        }
    }
}

/**
 * URLパラメタをDictionaryに変換
 * @param {*} params 
 * @returns 
 */
function paramToDict(params) {
    const p = new URLSearchParams(params);
    const dict = {};

    p.forEach((value, key) => {
        dict[key] = value;
    });
    return dict;
}
