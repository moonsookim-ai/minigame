// 게임 페이지 공통 도우미: 테마, 토스트, 결과/규칙 창
(function () {
  const THEME_KEY = "minigame.theme";
  try {
    const t = JSON.parse(localStorage.getItem(THEME_KEY));
    if (t) document.documentElement.dataset.theme = t;
  } catch (e) {}

  let toastEl, toastTimer;
  function toast(msg, ms) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms || 2000);
  }

  // showModal({ title, html, buttons: [{ label, primary, onClick }] })
  // 버튼을 누르면 창이 닫히고 onClick 이 호출된다.
  function showModal(opts) {
    let back = document.getElementById("mgModal");
    if (!back) {
      back = document.createElement("div");
      back.id = "mgModal";
      back.className = "modal-backdrop";
      back.innerHTML = '<div class="modal" role="dialog" aria-modal="true"></div>';
      document.body.appendChild(back);
    }
    const box = back.firstElementChild;
    box.innerHTML = `<h2></h2><div class="modal-body"></div><div class="controls"></div>`;
    box.querySelector("h2").textContent = opts.title || "";
    box.querySelector(".modal-body").innerHTML = opts.html || "";
    const ctl = box.querySelector(".controls");
    (opts.buttons || [{ label: "확인", primary: true }]).forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-sm " + (b.primary ? "btn-primary" : "btn-ghost");
      btn.textContent = b.label;
      btn.addEventListener("click", () => {
        back.hidden = true;
        if (b.onClick) b.onClick();
      });
      ctl.appendChild(btn);
    });
    back.hidden = false;
    const first = ctl.querySelector(".btn-primary") || ctl.firstElementChild;
    if (first) first.focus();
  }

  function hideModal() {
    const back = document.getElementById("mgModal");
    if (back) back.hidden = true;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  window.MG = { toast, showModal, hideModal, sleep };
})();
