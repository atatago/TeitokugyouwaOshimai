// background.js

/**
 * Windowsに通知を送信する関数
 * @param {string} title - タイトル
 * @param {string} message - メッセージ
 */
function sendNotification(title, message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/mikasa.png',
        title: title,
        message: message,
        priority: 2
    });
}

/**
 * ミュート状態変更
 */
function changeMuteCondition () {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const currentTab = tabs[0];
        
        chrome.tabs.get(currentTab.id, function(tab) {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                return;
            } else {
                chrome.tabs.update(tab.id, { muted: !tab.mutedInfo.muted }, function() {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError.message);
                    } else {
                        const data = {
                             action: "MUTE_STATUS_CHANGED",
                             muted: !tab.mutedInfo.muted,
                        };
                        //chrome.runtime.sendMessage(data);
                        chrome.tabs.sendMessage(tab.id, data, { frameId: 0 })
                            .catch(e => console.info(e));
                    }
                });
            }
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 1. 子フレームの content.js から API データを受信したか確認
    switch (request.action) {
        case "API_DATA_RECEIVED":
            // メッセージを送信したタブ (sender.tab) の ID を取得
            const tabId = sender.tab.id;
            const path = request.data.path;
            const requestBody = request.data.requestBody;

            if (tabId) {
                // 3. そのタブの親フレーム (tabId, frameId: 0) にメッセージを再送
                // frameId: 0 は常にメインウィンドウ (親フレーム) を指します。
                chrome.tabs.sendMessage(tabId, request, { frameId: 0 })
                    .catch(e => console.info(e));
            }

            if (path.includes('api_req_hensei/change')) {
                const params = new URLSearchParams(requestBody);
            }
            break;
        case "SEND_NOTIFICATION":
            sendNotification(request.title, request.message);
            break;
        case "CHANGE_MUTE_TAB":
            changeMuteCondition();
            break;
    }
});