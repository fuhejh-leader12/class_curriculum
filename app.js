(function () {
  "use strict";

  var DATA = window.SCHEDULE_DATA;
  var DAYS = DATA.days; // ['星期一', ..., '星期五']
  var classes = DATA.classes;
  var teachers = DATA.teachers;

  var classCodes = Object.keys(classes);
  var teacherNames = Object.keys(teachers);

  var els = {
    input: document.getElementById("search-input"),
    clearBtn: document.getElementById("clear-btn"),
    suggestions: document.getElementById("suggestions"),
    quickBrowse: document.getElementById("quick-browse"),
    browseList: document.getElementById("browse-list"),
    panelLeft: document.getElementById("panel-left"),
    panelRight: document.getElementById("panel-right"),
    swapBtn: document.getElementById("swap-btn"),
    termLabel: document.getElementById("term-label"),
    footerNote: document.getElementById("footer-note"),
  };

  els.termLabel.textContent = "新北市立福和國中・" + DATA.generated;
  els.footerNote.textContent =
    "資料來源：" + DATA.generated + "班課表。如發現課表有誤，請聯繫教務處。";

  // state.left / state.right: { type: 'class'|'teacher', key: string } | null
  var state = { left: null, right: null };

  function todayIndex() {
    var d = new Date().getDay(); // 0 Sun ... 6 Sat
    return d >= 1 && d <= 5 ? d - 1 : -1;
  }

  // ---------- Search / suggestions ----------

  function rankMatches(list, query) {
    var q = query.trim();
    if (!q) return [];
    var exact = [],
      starts = [],
      contains = [];
    list.forEach(function (item) {
      if (item === q) exact.push(item);
      else if (item.indexOf(q) === 0) starts.push(item);
      else if (item.indexOf(q) !== -1) contains.push(item);
    });
    return exact.concat(starts, contains);
  }

  function buildSuggestions(query) {
    var classMatches = rankMatches(classCodes, query).slice(0, 8);
    var teacherMatches = rankMatches(teacherNames, query).slice(0, 8);
    var items = [];
    classMatches.forEach(function (code) {
      var c = classes[code];
      items.push({
        type: c.type === "elective" ? "elective" : "class",
        key: code,
        label: code,
        sub: c.type === "elective" ? "選修／技藝分組" : c.homeroom_teacher ? "導師 " + c.homeroom_teacher : "班級",
      });
    });
    teacherMatches.forEach(function (name) {
      items.push({ type: "teacher", key: name, label: name, sub: "老師" });
    });
    return items.slice(0, 12);
  }

  function renderSuggestions(query) {
    var items = buildSuggestions(query);
    els.browseList.hidden = true;
    if (!query.trim()) {
      els.suggestions.hidden = true;
      els.suggestions.innerHTML = "";
      els.quickBrowse.hidden = false;
      return;
    }
    els.quickBrowse.hidden = true;
    if (items.length === 0) {
      els.suggestions.hidden = false;
      els.suggestions.innerHTML = '<div class="no-result">找不到符合的班級或老師，換個關鍵字試試看</div>';
      return;
    }
    els.suggestions.hidden = false;
    els.suggestions.innerHTML = items
      .map(function (it) {
        var badgeClass = it.type === "teacher" ? "b-teacher" : it.type === "elective" ? "b-elective" : "b-class";
        var badgeText = it.type === "teacher" ? "老師" : it.type === "elective" ? "選修" : "班級";
        return (
          '<button class="suggestion-item" data-type="' +
          (it.type === "elective" ? "class" : it.type) +
          '" data-key="' +
          encodeURIComponent(it.key) +
          '">' +
          '<span class="badge ' +
          badgeClass +
          '">' +
          badgeText +
          "</span>" +
          "<span>" +
          it.label +
          "</span>" +
          '<span class="s-sub">' +
          it.sub +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function resetSearchUI() {
    els.input.value = "";
    els.clearBtn.hidden = true;
    els.suggestions.hidden = true;
    els.browseList.hidden = true;
    els.quickBrowse.hidden = false;
  }

  els.suggestions.addEventListener("click", function (e) {
    var btn = e.target.closest(".suggestion-item");
    if (!btn) return;
    var type = btn.getAttribute("data-type");
    var key = decodeURIComponent(btn.getAttribute("data-key"));
    setPanel("left", type, key);
    resetSearchUI();
  });

  els.input.addEventListener("input", function () {
    els.clearBtn.hidden = !els.input.value;
    renderSuggestions(els.input.value);
  });

  els.input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var items = buildSuggestions(els.input.value);
      if (items.length) {
        setPanel("left", items[0].type === "teacher" ? "teacher" : "class", items[0].key);
        resetSearchUI();
      }
    }
  });

  els.clearBtn.addEventListener("click", function () {
    resetSearchUI();
    els.input.focus();
  });

  // ---------- Quick browse ----------

  els.quickBrowse.addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    var browse = chip.getAttribute("data-browse");
    var list;
    if (browse === "elective") {
      list = classCodes.filter(function (c) {
        return classes[c].type === "elective";
      });
    } else {
      list = classCodes.filter(function (c) {
        return classes[c].type === "homeroom" && c.charAt(0) === browse;
      });
    }
    list.sort();
    els.browseList.hidden = false;
    els.suggestions.hidden = true;
    els.browseList.innerHTML = list
      .map(function (code) {
        return '<button data-code="' + encodeURIComponent(code) + '">' + code + "</button>";
      })
      .join("");
  });

  els.browseList.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-code]");
    if (!btn) return;
    setPanel("left", "class", decodeURIComponent(btn.getAttribute("data-code")));
  });

  // ---------- Panel rendering ----------

  function entityLabel(type, key) {
    if (type === "teacher") return key + " 老師";
    var c = classes[key];
    if (!c) return key;
    return c.type === "elective" ? key : key + " 班";
  }

  function entityMeta(type, key) {
    if (type === "teacher") {
      var list = teachers[key] || [];
      return "每週授課 " + list.length + " 節";
    }
    var c = classes[key];
    if (!c) return "";
    if (c.type === "elective") return "選修／技藝分組";
    return c.homeroom_teacher ? "導師　" + c.homeroom_teacher : "班級課表";
  }

  // Build a day(0-4)-period map of entries for a given entity.
  function buildCellMap(type, key) {
    var cells = {}; // "d-p" -> array of {subject, whoType, whoKey, note}
    function push(d, p, subject, whoType, whoKey, note) {
      var k = d + "-" + p;
      cells[k] = cells[k] || [];
      cells[k].push({ subject: subject, whoType: whoType, whoKey: whoKey, note: note });
    }
    if (type === "class") {
      var c = classes[key];
      if (!c) return cells;
      c.entries.forEach(function (e) {
        if (e.split) {
          e.split.forEach(function (g) {
            push(e.day, e.period, g.subject, "teacher", g.teacher, g.week);
          });
        } else {
          push(e.day, e.period, e.subject, e.teacher ? "teacher" : null, e.teacher, null);
        }
      });
    } else {
      var list = teachers[key] || [];
      list.forEach(function (e) {
        push(e.day, e.period, e.subject, "class", e.class, e.week || null);
      });
    }
    return cells;
  }

  function cellHtml(entries, targetSide) {
    if (!entries || !entries.length) return '<span class="cell-empty">－</span>';
    return entries
      .map(function (en) {
        var tag = en.note ? '<span class="cell-week-tag">' + en.note + "</span>" : "";
        var who = en.whoKey
          ? '<button class="cell-who" data-side="' +
            targetSide +
            '" data-type="' +
            en.whoType +
            '" data-key="' +
            encodeURIComponent(en.whoKey) +
            '">' +
            en.whoKey +
            "</button>"
          : "";
        return '<div class="cell-entry">' + tag + '<span class="cell-subject">' + en.subject + "</span>" + who + "</div>";
      })
      .join("");
  }

  function buildTableHtml(type, key, targetSide) {
    var cells = buildCellMap(type, key);
    var periodsUsed = {};
    Object.keys(cells).forEach(function (k) {
      var p = parseInt(k.split("-")[1], 10);
      periodsUsed[p] = true;
    });
    var periods = Object.keys(periodsUsed)
      .map(Number)
      .sort(function (a, b) {
        return a - b;
      });
    if (!periods.length) {
      return '<div class="panel-placeholder"><span class="ph-strong">本學期查無排課</span></div>';
    }
    var today = todayIndex();
    var html = '<table class="sched-table"><thead><tr><th class="period-col">節</th>';
    for (var d = 0; d < 5; d++) {
      html +=
        '<th data-today="' +
        (d === today ? "1" : "0") +
        '">' +
        DAYS[d].replace("星期", "") +
        (d === today ? '<span class="today-dot"></span>' : "") +
        "</th>";
    }
    html += "</tr></thead><tbody>";
    periods.forEach(function (p) {
      html += '<tr><td class="period-cell">' + p + "</td>";
      for (var d = 0; d < 5; d++) {
        html += "<td>" + cellHtml(cells[d + "-" + p], targetSide) + "</td>";
      }
      html += "</tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  function placeholderHtml(side) {
    var otherLabel = side === "left" ? "右側" : "左側";
    return (
      '<div class="panel-placeholder">' +
      '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>' +
      (side === "left"
        ? '<span class="ph-strong">輸入班級或老師姓名開始查詢</span><span>結果會顯示在這裡</span>'
        : '<span class="ph-strong">點選' + otherLabel + "課表中的姓名或班級</span><span>即可在這裡比較課表</span>") +
      "</div>"
    );
  }

  function renderPanel(side) {
    var el = side === "left" ? els.panelLeft : els.panelRight;
    var sel = state[side];
    if (!sel) {
      el.innerHTML = placeholderHtml(side);
      return;
    }
    var targetSide = side === "left" ? "right" : "left";
    var tableHtml = buildTableHtml(sel.type, sel.key, targetSide);
    el.innerHTML =
      '<div class="panel-header"><div class="panel-heading">' +
      '<span class="panel-title">' +
      entityLabel(sel.type, sel.key) +
      "</span>" +
      '<span class="panel-meta">' +
      entityMeta(sel.type, sel.key) +
      "</span>" +
      "</div>" +
      '<button class="panel-clear" data-side="' +
      side +
      '" aria-label="清除">×</button>' +
      "</div>" +
      tableHtml;
  }

  function setPanel(side, type, key) {
    state[side] = { type: type, key: key };
    renderPanel(side);
  }

  function clearPanel(side) {
    state[side] = null;
    renderPanel(side);
  }

  // Delegate clicks on cell "who" links and panel clear buttons.
  document.addEventListener("click", function (e) {
    var who = e.target.closest(".cell-who");
    if (who) {
      var side = who.getAttribute("data-side");
      var type = who.getAttribute("data-type");
      var key = decodeURIComponent(who.getAttribute("data-key"));
      setPanel(side, type, key);
      return;
    }
    var clearBtn = e.target.closest(".panel-clear");
    if (clearBtn) {
      clearPanel(clearBtn.getAttribute("data-side"));
    }
  });

  els.swapBtn.addEventListener("click", function () {
    var tmp = state.left;
    state.left = state.right;
    state.right = tmp;
    renderPanel("left");
    renderPanel("right");
  });

  // init
  renderPanel("left");
  renderPanel("right");
})();
