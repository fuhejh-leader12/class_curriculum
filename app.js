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
    result: document.getElementById("result"),
    resultTitle: document.getElementById("result-title"),
    resultMeta: document.getElementById("result-meta"),
    weekGrid: document.getElementById("week-grid"),
    backBtn: document.getElementById("back-btn"),
    emptyState: document.getElementById("empty-state"),
    termLabel: document.getElementById("term-label"),
    footerNote: document.getElementById("footer-note"),
  };

  els.termLabel.textContent = "新北市立福和國中・" + DATA.generated;
  els.footerNote.textContent =
    "資料來源：" + DATA.generated + "班課表。如發現課表有誤，請聯繫教務處。";

  function todayIndex() {
    var d = new Date().getDay(); // 0 Sun ... 6 Sat
    return d >= 1 && d <= 5 ? d - 1 : -1;
  }

  function classLabel(code) {
    var c = classes[code];
    if (!c) return code;
    return c.type === "elective" ? code + "（選修／技藝分組）" : code + " 班";
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
    els.emptyState.hidden = true;
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
          it.type +
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

  els.suggestions.addEventListener("click", function (e) {
    var btn = e.target.closest(".suggestion-item");
    if (!btn) return;
    var type = btn.getAttribute("data-type");
    var key = decodeURIComponent(btn.getAttribute("data-key"));
    if (type === "teacher") selectTeacher(key);
    else selectClass(key);
  });

  els.input.addEventListener("input", function () {
    els.clearBtn.hidden = !els.input.value;
    hideResult();
    renderSuggestions(els.input.value);
  });

  els.input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var items = buildSuggestions(els.input.value);
      if (items.length) {
        if (items[0].type === "teacher") selectTeacher(items[0].key);
        else selectClass(items[0].key);
      }
    }
  });

  els.clearBtn.addEventListener("click", function () {
    els.input.value = "";
    els.clearBtn.hidden = true;
    hideResult();
    renderSuggestions("");
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
    els.emptyState.hidden = true;
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
    selectClass(decodeURIComponent(btn.getAttribute("data-code")));
  });

  // ---------- Result rendering ----------

  function hideResult() {
    els.result.hidden = true;
    els.emptyState.hidden = false;
  }

  function showResultShell(title, meta) {
    els.emptyState.hidden = true;
    els.result.hidden = false;
    els.suggestions.hidden = true;
    els.browseList.hidden = true;
    els.quickBrowse.hidden = true;
    els.resultTitle.textContent = title;
    els.resultMeta.textContent = meta;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function periodItemHtml(period, contentHtml) {
    return (
      '<li class="period-item"><span class="period-num">' +
      period +
      '</span><div class="period-info">' +
      contentHtml +
      "</div></li>"
    );
  }

  function whoLink(type, key, extraNote) {
    var safe = encodeURIComponent(key);
    return (
      '<button class="who-btn" data-type="' +
      type +
      '" data-key="' +
      safe +
      '">' +
      key +
      "</button>" +
      (extraNote ? '<span class="split-note">' + extraNote + "</span>" : "")
    );
  }

  function renderWeekGrid(entriesByDay, today) {
    var html = "";
    for (var d = 0; d < 5; d++) {
      var dayEntries = entriesByDay[d] || [];
      html += '<div class="day-col" data-day="' + d + '">';
      html +=
        '<h3 class="day-title"><span>' +
        DAYS[d] +
        "</span>" +
        (d === today ? '<span class="today-mark">今天</span>' : "") +
        "</h3>";
      if (!dayEntries.length) {
        html += '<div class="day-empty">本日無安排</div>';
      } else {
        html += '<ol class="period-list">';
        dayEntries.forEach(function (e) {
          html += periodItemHtml(e.period, e.html);
        });
        html += "</ol>";
      }
      html += "</div>";
    }
    els.weekGrid.innerHTML = html;
    els.weekGrid.querySelectorAll(".who-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var type = btn.getAttribute("data-type");
        var key = decodeURIComponent(btn.getAttribute("data-key"));
        if (type === "teacher") selectTeacher(key);
        else selectClass(key);
      });
    });
  }

  function selectClass(code) {
    var c = classes[code];
    if (!c) return;
    els.input.value = code;
    els.clearBtn.hidden = false;
    var byDay = {};
    c.entries.forEach(function (e) {
      byDay[e.day] = byDay[e.day] || [];
      var contentHtml;
      if (e.split) {
        contentHtml = e.split
          .map(function (g) {
            return (
              '<div class="period-line"><span class="subject">' +
              g.subject +
              "</span>" +
              whoLink("teacher", g.teacher) +
              "</div>"
            );
          })
          .join("") + '<div class="split-note">同節次有 2 組選修／輔導同時進行</div>';
      } else {
        contentHtml =
          '<div class="period-line"><span class="subject">' +
          e.subject +
          "</span>" +
          (e.teacher ? whoLink("teacher", e.teacher) : "") +
          "</div>";
      }
      byDay[e.day].push({ period: e.period, html: contentHtml });
    });
    Object.keys(byDay).forEach(function (d) {
      byDay[d].sort(function (a, b) {
        return a.period - b.period;
      });
    });
    var meta = c.type === "elective" ? "選修／技藝分組" : c.homeroom_teacher ? "導師　" + c.homeroom_teacher : "班級課表";
    showResultShell(classLabel(code).replace("（選修／技藝分組）", ""), meta);
    renderWeekGrid(byDay, todayIndex());
  }

  function selectTeacher(name) {
    var list = teachers[name];
    if (!list) return;
    els.input.value = name;
    els.clearBtn.hidden = false;
    var byDay = {};
    list.forEach(function (e) {
      byDay[e.day] = byDay[e.day] || [];
      var note = e.group ? "（選修／輔導分組）" : "";
      var contentHtml =
        '<div class="period-line"><span class="subject">' +
        e.subject +
        "</span>" +
        whoLink("class", e.class) +
        "</div>" +
        (note ? '<div class="split-note">' + note + "</div>" : "");
      byDay[e.day].push({ period: e.period, html: contentHtml });
    });
    Object.keys(byDay).forEach(function (d) {
      byDay[d].sort(function (a, b) {
        return a.period - b.period;
      });
    });
    var totalCount = list.length;
    showResultShell(name + " 老師", "每週授課 " + totalCount + " 節");
    renderWeekGrid(byDay, todayIndex());
  }

  els.backBtn.addEventListener("click", function () {
    els.input.value = "";
    els.clearBtn.hidden = true;
    hideResult();
    renderSuggestions("");
    els.input.focus();
  });

  // init
  hideResult();
})();
