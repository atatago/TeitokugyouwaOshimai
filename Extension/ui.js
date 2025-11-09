function getMainFrame() {
    return `
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
}

/**
 * 時間フォーマット
 * @param {*} totalSeconds 
 * @returns 
 */
function formatRemainingTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * 艦隊情報表示
 * @param {*} deck_port 
 * @param {*} ships
 * @param {*} masterData
 * @returns 
 */
function updateFleetInfoUI(deck_port, ships, masterData) {
    const listElement = document.getElementById('fleet-info-list');
    if (!listElement) return;

    let docksContent = '';
    deck_port.forEach(dock => {
        const fleet = createDeckInfo(dock, ships, masterData);
        docksContent += `<div id="fleet-id-${dock.api_id}" class="deck-box">${fleet}</div>`;
    });
    listElement.innerHTML = `<div class="flex-box">${docksContent}</div>`;
}

/**
 * 戦闘結果再表示
 * @param {*} data 
 * @returns 
 */
function updateBattleResultUI(data, masterData) {
    //console.info("BattleResult : " + JSON.stringify(data));
    //console.info("masterData : " + JSON.stringify(masterData));
    const deck = data.api_deck_data;
    const ships = data.api_ship_data;
    deck.map(d => {
        const listElement = document.getElementById(`fleet-id-${d.api_id}`);
        if (!listElement) return;

        listElement.innerHTML = createDeckInfo(d, ships, masterData);
    });
}

/**
 * 艦隊情報表示
 * @param {*} deck 
 * @param {*} ships 
 * @param {*} masterData 
 * @returns 
 */
function createDeckInfo(deck, ships, masterData) {
    //console.info("deck : " + JSON.stringify(deck));
    //console.info("ship : " + JSON.stringify(ships));

    const canCharge = deck.api_ship.filter(id => id > 0).some(id => {
        const ship = ships.filter(s => s.api_id === id)[0];
        const shipM = masterData.api_mst_ship.filter(s => s.api_id === ship.api_ship_id)[0];

        return ship.api_bull != shipM.api_bull_max
            || ship.api_fuel != shipM.api_fuel_max;
    });

    const fleetHead = `
        <div class="flex-box">
            <span class="deck-battle" style="${deck.isBattle ? '' : 'display: none;'}">${deck.isBossBattle ? '[ボス戦]' : '[戦闘(' + deck.battleCount + ')]'}</span>
            <span class="deck-mission" style="${deck.api_mission[0] !== 1 ? 'display: none;' : ''}">[遠征]</span>
            <span class="deck-charge" style="${!canCharge ? 'display: none;' : ''}">[補給]</span>
            <span>${deck.api_name}</span>
        </div>`;
    const fleetBody = deck.api_ship.map(id =>
        ships.filter(r => r.api_id === id)
            .map(s => createShipInfo(s, masterData))
            .join('')
    ).join('');
    return fleetHead + fleetBody;
}

/**
 * 艦情報表示
 * @param {*} ship
 * @param {*} masterData
 * @returns 
 */
function createShipInfo(ship, masterData) {
    const { api_nowhp, api_maxhp, api_cond, api_lv, api_exp } = ship;
    //console.info("ship : " + JSON.stringify(ship));
    //console.info("masterData : " + JSON.stringify(masterData));
    const shipMaster = masterData.api_mst_ship.filter(s => s.api_id === ship.api_ship_id)[0];
    const name = shipMaster.api_name;
    //console.info("mast : " + JSON.stringify(shipMaster));

    // HPバーの色
    let hpColor = '#4CAF50'; // Green (健全)
    const hpRatio = api_nowhp / api_maxhp;
    let isTaiha = false;
    if (hpRatio <= 0.25) {
        hpColor = '#F44336'; // Red (大破)
        isTaiha = true;
    } else if (hpRatio <= 0.5) {
        hpColor = '#FF9800'; // Orange (中破)
    } else if (hpRatio <= 0.75) {
        hpColor = '#FFEB3B'; // Yellow (小破)
    }

    // テンプレートリテラルで統一フォーマットを定義
    return `
        <div class="ship-box" style="${isTaiha ? 'background-color: #F44336' : ''}">
            <div class="ship-info">
                <span class="ship-cond">
                    <span style="color: ${api_cond < 30 ? '#FF0000' : api_cond < 30 ? '#FF6600' : api_cond < 50 ? '#FFFFFF' : '#FFFF00'};">■</span>${api_cond}
                </span>
                <li class="ship-name">
                    ${name} 
                </li>
            </div>
            
            <div>
                <div class="flex-box">
                    <span class="ship-lv">Lv.${api_lv} (Next.${api_exp[1]})</span>
                    <span class="ship-hp">HP: ${api_nowhp} / ${api_maxhp}</span>
                </div>
                <div class="ship-hp-bar-box">
                    <div class="ship-hp-bar" style="width: ${hpRatio * 100}%; background-color: ${hpColor};"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 任務情報表示
 * @param {*} questData 
 * @returns 
 */
function updateQuestList(questData) {
    const listElement = document.getElementById('quest-list');
    if (!listElement) return;
    //console.info("quest : " + JSON.stringify(questData));

    let htmlContent = '';
    questData.data.api_data.api_list.filter(r => r.api_state === 2 || r.api_state === 3).forEach(r => {
        htmlContent += `
            <li class="quest-title">
            <details>
                <summary>
                    <span style="color: ${r.api_category === 1 ? '#1dff1d' :  //編成
                r.api_category === 2 ? '#FF0000' :  //戦闘
                    r.api_category === 3 ? '#1dd11d' :  //演習
                        r.api_category === 4 ? '#00bfff' :  //遠征
                            r.api_category === 5 ? '#FFFF00' :  //補給
                                r.api_category === 6 ? '#D2691E' :  //工廠
                                    r.api_category === 7 ? '#dda0dd' :  //改装
                                        r.api_category === 8 ? '#000000' :  //？？？？
                                            r.api_category === 9 ? '#FF0000' :  //戦闘
                                                r.api_category === 10 ? '#FF0000' : //戦闘
                                                    r.api_category === 11 ? '#D2691E' : //工廠
                                                        '#000000'};">■</span>
                    ${r.api_title}
                    <span class="quest-progress50" style="${r.api_progress_flag !== 1 ? 'display: none;' : ''}">50%</span>
                    <span class="quest-progress80" style="${r.api_progress_flag !== 2 ? 'display: none;' : ''}">80%</span>
                    <span class="quest-complete" style="${r.api_state !== 3 ? 'display: none;' : ''}">[達成]</span>
                </summary>
                ${r.api_detail}
            </details>
            </li>
            `;
    });
    listElement.innerHTML = htmlContent;
}
