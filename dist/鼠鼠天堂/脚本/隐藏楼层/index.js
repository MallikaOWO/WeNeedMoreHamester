$(()=>{$('#chat > .mes').not('.last_mes').remove();let e=SillyTavern.getCurrentChatId();eventOn(tavern_events.CHAT_CHANGED,t=>{e!==t&&(e=t,reloadIframe())})});
//# sourceMappingURL=index.js.map