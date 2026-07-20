// xhr_hook_injector.js
function sendInternalMessage(data) {
    window.postMessage(data, "*"); 
}

(function() {
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        // インスタンスにデータを保存
        this._url = url; 
        this._method = method;
        this._requestBody = null;

        originalOpen.apply(this, arguments);
    };

    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
        this.addEventListener('readystatechange', () => {
        this._requestBody = body ? body.toString() : '';

            if (this.readyState === 4 && this.status === 200) {
                if (this._url && this._url.includes('/kcsapi/')) {
                    try {
                        const responseText = this.responseText.replace(/^svdata=/, '');
                        const responseJSON = JSON.parse(responseText);

                        sendInternalMessage({
                            type: "KANCOLLE_API_DATA",
                            path: this._url.split('/kcsapi/')[1],
                            data: responseJSON,
                            requestBody: this._requestBody,
                            method: this._method,
                        });
                    } catch (e) {
                        console.error("API Processing Error:", e);
                    }
                }
            }
        });

        originalSend.apply(this, arguments);
    };
})();