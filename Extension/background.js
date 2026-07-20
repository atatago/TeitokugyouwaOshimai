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
function changeMuteCondition (tabId) {
    chrome.tabs.get(tabId, function(tab) {
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
                    chrome.tabs.sendMessage(tab.id, data, { frameId: 0 }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.info('Mute status message delivery failed:', chrome.runtime.lastError.message);
                        }
                    });
                }
            });
        }
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
                chrome.tabs.sendMessage(tabId, request, { frameId: 0 }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.info('Message delivery failed:', chrome.runtime.lastError.message);
                    }
                });
            }

            if (path.includes('api_req_hensei/change')) {
                const params = new URLSearchParams(requestBody);
            }
            break;

        case "SEND_NOTIFICATION":
            sendNotification(request.title, request.message);
            break;

        case "CHANGE_MUTE_TAB":
            changeMuteCondition(sender.tab.id);
            break;

        case "SCREENSHOT_DOWNLOAD":
            chrome.tabs.query({ active: true, currentWindow: true })
                .then(([tab]) => {
                    if (!tab) return;
                    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
                        if (chrome.runtime.lastError) {
                            console.error("Capture error:", chrome.runtime.lastError.message);
                            return;
                        }
                        chrome.tabs.sendMessage(tab.id, { action: 'CLOP_IMAGE', imageUrl: dataUrl }, { frameId: 0 });
                    });
                });
            break;

        case "IMAGE_DOWNLOAD":
            chrome.downloads.download({
                url: request.imageUrl,
                filename: 'kancolle_screenshot_' + Date.now() + '.png',
                saveAs: false
            });
            break;
    }
});