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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 1. 子フレームの content.js から API データを受信したか確認
    if (request.action === "API_DATA_RECEIVED") {

        // 2. メッセージを送信したタブ (sender.tab) の ID を取得
        const tabId = sender.tab.id;
        const path = request.data.path;
        const requestBody = request.data.requestBody;

        if (tabId) {
            // 3. そのタブの親フレーム (tabId, frameId: 0) にメッセージを再送
            // frameId: 0 は常にメインウィンドウ (親フレーム) を指します。
            chrome.tabs.sendMessage(tabId, request, { frameId: 0 })
                .catch(e => console.info(e)/*console.error("Error forwarding message to main frame:", e)*/);
        }

        if (path.includes('api_req_hensei/change')) {
            const params = new URLSearchParams(requestBody);
        }
    } else if (request.action === "SEND_NOTIFICATION") {
        sendNotification(request.title, request.message);
    }
});