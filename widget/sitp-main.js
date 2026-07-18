(function(){
  var BOT_ID="sitp-main";
  var API_BASE="https://yoursite.asia";
  if (document.getElementById("sitpgpt-widget-root")) return;

  var root=document.createElement("div");
  root.id="sitpgpt-widget-root";
  root.setAttribute("data-sitpgpt-widget","1");
  document.body.appendChild(root);

  var style=document.createElement("style");
  style.textContent=[
    "#sitpgpt-widget-root{position:fixed;z-index:2147483000;font-family:Inter,system-ui,sans-serif}",
    "#sitpgpt-bubble{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:#111;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.2);font-size:24px}",
    "#sitpgpt-panel{position:fixed;right:20px;bottom:88px;width:min(360px,calc(100vw - 40px));height:460px;background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.18);display:none;flex-direction:column;overflow:hidden;border:1px solid #e5e7eb}",
    "#sitpgpt-panel.open{display:flex}",
    "#sitpgpt-head{padding:12px 14px;background:#111;color:#fff;font-weight:600;display:flex;justify-content:space-between;align-items:center}",
    "#sitpgpt-close{background:none;border:none;color:#fff;font-size:20px;cursor:pointer}",
    "#sitpgpt-messages{flex:1;overflow:auto;padding:12px;font-size:14px;line-height:1.5}",
    ".sitpgpt-msg{margin:8px 0;padding:8px 10px;border-radius:10px;max-width:90%}",
    ".sitpgpt-user{margin-left:auto;background:#111;color:#fff}",
    ".sitpgpt-bot{background:#f3f4f6;color:#111}",
    "#sitpgpt-input-row{display:flex;gap:8px;padding:10px;border-top:1px solid #e5e7eb}",
    "#sitpgpt-input{flex:1;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:14px}",
    "#sitpgpt-send{border:none;background:#111;color:#fff;border-radius:8px;padding:0 12px;cursor:pointer}"
  ].join("");
  document.head.appendChild(style);

  root.innerHTML='<button id="sitpgpt-bubble" aria-label="Open Sitp GPT">💬</button>'
    +'<div id="sitpgpt-panel"><div id="sitpgpt-head"><span>Sitp GPT</span><button id="sitpgpt-close" aria-label="Close">×</button></div>'
    +'<div id="sitpgpt-messages"><div class="sitpgpt-msg sitpgpt-bot">Hi! Ask me about Sitp GPT plans, tools, and setup.</div></div>'
    +'<div id="sitpgpt-input-row"><input id="sitpgpt-input" placeholder="Ask anything…" /><button id="sitpgpt-send">➤</button></div></div>';

  var panel=document.getElementById("sitpgpt-panel");
  var messages=document.getElementById("sitpgpt-messages");
  var input=document.getElementById("sitpgpt-input");
  var history=[];

  function addMsg(role,text){
    var el=document.createElement("div");
    el.className="sitpgpt-msg "+(role==="user"?"sitpgpt-user":"sitpgpt-bot");
    el.textContent=text;
    messages.appendChild(el);
    messages.scrollTop=messages.scrollHeight;
  }

  async function send(){
    var text=(input.value||"").trim();
    if(!text) return;
    input.value="";
    addMsg("user",text);
    try{
      var res=await fetch(API_BASE+"/api/ai/assistant",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:text,history:history})
      });
      var data=await res.json();
      var reply=(data&&data.reply)||"Sorry, no reply.";
      addMsg("bot",reply);
      history.push({role:"user",content:text});
      history.push({role:"assistant",content:reply});
    }catch(e){
      addMsg("bot","Network error. Try again later.");
    }
  }

  document.getElementById("sitpgpt-bubble").onclick=function(){panel.classList.toggle("open");};
  document.getElementById("sitpgpt-close").onclick=function(){panel.classList.remove("open");};
  document.getElementById("sitpgpt-send").onclick=send;
  input.addEventListener("keydown",function(e){if(e.key==="Enter")send();});

  fetch(API_BASE+"/api/widget/ping?bot="+encodeURIComponent(BOT_ID)
    +"&host="+encodeURIComponent(location.hostname)
    +"&page="+encodeURIComponent(location.href),{mode:"cors"}).catch(function(){});
})();