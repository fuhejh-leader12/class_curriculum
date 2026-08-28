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

  // Always show every period used anywhere in the school, so an entity with
  // no class in a given period still shows that row (as empty) instead of
  // the row silently disappearing.
  var GLOBAL_MAX_PERIOD = (function () {
    var max = 1;
    classCodes.forEach(function (code) {
      classes[code].entries.forEach(function (e) {
        if (e.period > max) max = e.period;
      });
    });
    return max;
  })();

  function buildTableHtml(type, key, targetSide) {
    var cells = buildCellMap(type, key);
    var hasAnyEntry = Object.keys(cells).length > 0;
    if (!hasAnyEntry) {
      return '<div class="panel-placeholder"><span class="ph-strong">本學期查無排課</span></div>';
    }
    var periods = [];
    for (var p = 1; p <= GLOBAL_MAX_PERIOD; p++) periods.push(p);
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

  // ---------- 調課小幫手: 找代課／調課人選 + 衝堂快速確認 ----------

  var BUSY = {}; // "day-period" -> { teacherName: true }
  var SUBJECT_TEACHERS = {}; // subject -> { teacherName: true }

  function markBusy(d, p, name) {
    var k = d + "-" + p;
    BUSY[k] = BUSY[k] || {};
    BUSY[k][name] = true;
  }
  function markSubject(subject, name) {
    SUBJECT_TEACHERS[subject] = SUBJECT_TEACHERS[subject] || {};
    SUBJECT_TEACHERS[subject][name] = true;
  }
  classCodes.forEach(function (code) {
    classes[code].entries.forEach(function (e) {
      if (e.split) {
        e.split.forEach(function (g) {
          markBusy(e.day, e.period, g.teacher);
          markSubject(g.subject, g.teacher);
        });
      } else if (e.teacher) {
        markBusy(e.day, e.period, e.teacher);
        markSubject(e.subject, e.teacher);
      }
    });
  });

  function freeTeachersAt(d, p) {
    var busy = BUSY[d + "-" + p] || {};
    return teacherNames.filter(function (n) {
      return !busy[n];
    });
  }
  function classTeacherSet(code) {
    var set = {};
    var c = classes[code];
    if (!c) return set;
    c.entries.forEach(function (e) {
      if (e.split) e.split.forEach(function (g) { set[g.teacher] = true; });
      else if (e.teacher) set[e.teacher] = true;
    });
    return set;
  }

  var toolEls = {
    subClassInput: document.getElementById("sub-class-input"),
    subClassSuggestions: document.getElementById("sub-class-suggestions"),
    subSlotSelect: document.getElementById("sub-slot-select"),
    subResult: document.getElementById("sub-result"),
    confTeacherInput: document.getElementById("conf-teacher-input"),
    confTeacherSuggestions: document.getElementById("conf-teacher-suggestions"),
    confDaySelect: document.getElementById("conf-day-select"),
    confPeriodSelect: document.getElementById("conf-period-select"),
    confResult: document.getElementById("conf-result"),
  };

  function renderMiniSuggestions(listEl, matches, onPick) {
    if (!matches.length) {
      listEl.hidden = true;
      listEl.innerHTML = "";
      return;
    }
    listEl.hidden = false;
    listEl.innerHTML = matches
      .map(function (m) {
        return '<button type="button" data-key="' + encodeURIComponent(m) + '">' + m + "</button>";
      })
      .join("");
    Array.prototype.forEach.call(listEl.querySelectorAll("button"), function (btn) {
      btn.addEventListener("click", function () {
        onPick(decodeURIComponent(btn.getAttribute("data-key")));
        listEl.hidden = true;
        listEl.innerHTML = "";
      });
    });
  }

  function jumpToLeft(type, key) {
    setPanel("left", type, key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- 找代課／調課人選 ----

  toolEls.subClassInput.addEventListener("input", function () {
    var q = toolEls.subClassInput.value.trim();
    if (!q) {
      toolEls.subClassSuggestions.hidden = true;
      return;
    }
    var matches = rankMatches(classCodes, q).slice(0, 10);
    renderMiniSuggestions(toolEls.subClassSuggestions, matches, function (code) {
      toolEls.subClassInput.value = code;
      populateSubSlotSelect(code);
    });
  });

  toolEls.subClassInput.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var matches = rankMatches(classCodes, toolEls.subClassInput.value.trim());
    if (matches.length) {
      toolEls.subClassInput.value = matches[0];
      populateSubSlotSelect(matches[0]);
      toolEls.subClassSuggestions.hidden = true;
    }
  });

  function populateSubSlotSelect(code) {
    var c = classes[code];
    if (!c) return;
    var entries = [];
    c.entries.forEach(function (e) {
      if (e.split) {
        e.split.forEach(function (g) {
          entries.push({ day: e.day, period: e.period, subject: g.subject, teacher: g.teacher, week: g.week });
        });
      } else if (e.teacher) {
        entries.push({ day: e.day, period: e.period, subject: e.subject, teacher: e.teacher });
      }
    });
    entries.sort(function (a, b) {
      return a.day - b.day || a.period - b.period;
    });
    toolEls.subSlotSelect.disabled = entries.length === 0;
    toolEls.subSlotSelect.innerHTML = entries.length
      ? entries
          .map(function (e, i) {
            var label = DAYS[e.day].replace("星期", "") + " 第" + e.period + "節：" + e.subject + (e.week ? "（" + e.week + "）" : "");
            return '<option value="' + i + '">' + label + "</option>";
          })
          .join("")
      : "<option>此班無排課</option>";
    toolEls.subSlotSelect._entries = entries;
    toolEls.subSlotSelect._classCode = code;
    if (entries.length) renderSubResult(code, entries[0]);
    else toolEls.subResult.innerHTML = "";
  }

  toolEls.subSlotSelect.addEventListener("change", function () {
    var entries = toolEls.subSlotSelect._entries || [];
    var idx = parseInt(toolEls.subSlotSelect.value, 10);
    if (!isNaN(idx) && entries[idx]) renderSubResult(toolEls.subSlotSelect._classCode, entries[idx]);
  });

  function candidateGroupHtml(title, list, dotLabel, collapsed) {
    if (!list.length) return "";
    var chips = list
      .map(function (n) {
        return '<button type="button" class="candidate-chip" data-name="' + encodeURIComponent(n) + '">' + n + "</button>";
      })
      .join("");
    if (collapsed) {
      return (
        '<details class="candidate-group candidate-group-collapsible"><summary class="candidate-group-title"><span class="rank-dot">' +
        dotLabel +
        "</span>" +
        title +
        "（" +
        list.length +
        " 位）</summary>" +
        '<div class="candidate-chips">' +
        chips +
        "</div></details>"
      );
    }
    return (
      '<div class="candidate-group"><p class="candidate-group-title"><span class="rank-dot">' +
      dotLabel +
      "</span>" +
      title +
      '</p><div class="candidate-chips">' +
      chips +
      "</div></div>"
    );
  }

  function renderSubResult(code, slot) {
    var free = freeTeachersAt(slot.day, slot.period);
    var classTeachers = classTeacherSet(code);
    var subjectTeachers = SUBJECT_TEACHERS[slot.subject] || {};

    var g1 = [], g2 = [], g3 = [];
    free.forEach(function (name) {
      if (name === slot.teacher) return;
      if (subjectTeachers[name]) g1.push(name);
      else if (classTeachers[name]) g2.push(name);
      else g3.push(name);
    });
    g1.sort(); g2.sort(); g3.sort();

    var weekNote = slot.week ? "（" + slot.week + "）" : "";
    var html =
      '<div class="slot-summary">' +
      code +
      "　" +
      DAYS[slot.day] +
      " 第" +
      slot.period +
      "節" +
      weekNote +
      "　目前：<strong>" +
      slot.subject +
      " " +
      (slot.teacher || "") +
      "</strong></div>";

    html += candidateGroupHtml("該科任課老師", g1, "1", false);
    html += candidateGroupHtml("該班任課老師", g2, "2", false);
    html += candidateGroupHtml("其他空堂老師", g3, "3", true);

    if (!g1.length && !g2.length && !g3.length) {
      html += '<p class="no-candidates">這個時段目前沒有空堂老師</p>';
    }

    toolEls.subResult.innerHTML = html;
    Array.prototype.forEach.call(toolEls.subResult.querySelectorAll(".candidate-chip"), function (btn) {
      btn.addEventListener("click", function () {
        jumpToLeft("teacher", decodeURIComponent(btn.getAttribute("data-name")));
      });
    });
  }

  // ---- 衝堂快速確認 ----

  var confSelectedTeacher = null;

  toolEls.confPeriodSelect.innerHTML = (function () {
    var opts = "";
    for (var p = 1; p <= GLOBAL_MAX_PERIOD; p++) opts += '<option value="' + p + '">第' + p + "節</option>";
    return opts;
  })();

  toolEls.confTeacherInput.addEventListener("input", function () {
    var q = toolEls.confTeacherInput.value.trim();
    if (!q) {
      toolEls.confTeacherSuggestions.hidden = true;
      return;
    }
    var matches = rankMatches(teacherNames, q).slice(0, 10);
    renderMiniSuggestions(toolEls.confTeacherSuggestions, matches, function (name) {
      toolEls.confTeacherInput.value = name;
      confSelectedTeacher = name;
      renderConfResult();
    });
  });

  toolEls.confTeacherInput.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var matches = rankMatches(teacherNames, toolEls.confTeacherInput.value.trim());
    if (matches.length) {
      toolEls.confTeacherInput.value = matches[0];
      confSelectedTeacher = matches[0];
      toolEls.confTeacherSuggestions.hidden = true;
      renderConfResult();
    }
  });

  toolEls.confDaySelect.addEventListener("change", renderConfResult);
  toolEls.confPeriodSelect.addEventListener("change", renderConfResult);

  function renderConfResult() {
    if (!confSelectedTeacher) {
      toolEls.confResult.innerHTML = "";
      return;
    }
    var d = parseInt(toolEls.confDaySelect.value, 10);
    var p = parseInt(toolEls.confPeriodSelect.value, 10);
    var busy = BUSY[d + "-" + p] || {};
    if (busy[confSelectedTeacher]) {
      var list = teachers[confSelectedTeacher] || [];
      var found = null;
      list.forEach(function (e) {
        if (e.day === d && e.period === p) found = e;
      });
      var info = found
        ? found.subject +
          "　" +
          '<button type="button" class="who-btn" data-key="' +
          encodeURIComponent(found.class) +
          '">' +
          found.class +
          "</button>"
        : "";
      toolEls.confResult.innerHTML = '<div class="conflict-status busy">✕ 有課：' + info + "</div>";
      var btn = toolEls.confResult.querySelector(".who-btn");
      if (btn) {
        btn.addEventListener("click", function () {
          jumpToLeft("class", decodeURIComponent(btn.getAttribute("data-key")));
        });
      }
    } else {
      toolEls.confResult.innerHTML = '<div class="conflict-status free">✓ 空堂，可以安排</div>';
    }
  }

  document.addEventListener("click", function (e) {
    if (!e.target.closest("#sub-class-input") && !e.target.closest("#sub-class-suggestions")) {
      toolEls.subClassSuggestions.hidden = true;
    }
    if (!e.target.closest("#conf-teacher-input") && !e.target.closest("#conf-teacher-suggestions")) {
      toolEls.confTeacherSuggestions.hidden = true;
    }
  });

  // init
  renderPanel("left");
  renderPanel("right");
})();
