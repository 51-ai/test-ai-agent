/* 训练可视化仪表盘 - 渲染逻辑（零构建，vanilla JS + Chart.js） */
(function () {
  'use strict';

  var KEY_STORAGE = 'ai-agent-dev-key';
  var LIMIT_STORAGE = 'ai-agent-history-limit';
  var REFRESH_MS = 15000;
  var timer = null;
  var charts = {}; // canvasId -> Chart 实例

  function getKey() {
    return localStorage.getItem(KEY_STORAGE) || '';
  }

  function getLimit() {
    var v = parseInt(localStorage.getItem(LIMIT_STORAGE) || '200', 10);
    return isFinite(v) && v > 0 ? v : 200;
  }

  /** 时间戳 → 横轴短标签（MM-DD HH:mm，跨天也能区分） */
  function fmtAxis(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function el(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var node = el(id);
    if (node) node.textContent = value;
  }

  function fmt(n, digits) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return n.toFixed(digits === undefined ? 2 : digits);
  }

  function pct(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return (n * 100).toFixed(1) + '%';
  }

  function rateClass(rate) {
    if (rate >= 0.8) return 'rate-good';
    if (rate >= 0.5) return 'rate-mid';
    return 'rate-bad';
  }

  function showError(msg) {
    var banner = el('error-banner');
    banner.textContent = msg;
    banner.classList.remove('hidden');
  }

  function hideError() {
    el('error-banner').classList.add('hidden');
  }

  /** 渲染或更新折线图（复用 Chart 实例，避免刷新时内存增长） */
  function renderLineChart(canvasId, labels, datasets, yScaleOptions) {
    var ctx = el(canvasId).getContext('2d');
    var config = {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        scales: Object.assign({
          x: { ticks: { color: '#8b93a3', maxTicksLimit: 10 }, grid: { color: 'rgba(38,43,54,0.6)' } },
          y: Object.assign({ ticks: { color: '#8b93a3' }, grid: { color: 'rgba(38,43,54,0.6)' } }, yScaleOptions || {})
        })
      },
      plugins: [{
        id: 'bg',
        beforeDraw: function (chart) {
          var c = chart.ctx;
          c.save();
          c.fillStyle = '#171a21';
          c.fillRect(0, 0, chart.width, chart.height);
          c.restore();
        }
      }]
    };

    if (charts[canvasId]) {
      charts[canvasId].data = config.data;
      charts[canvasId].update('none');
      return;
    }

    // Chart.js 全局深色默认值
    Chart.defaults.color = '#8b93a3';
    Chart.defaults.borderColor = 'rgba(38,43,54,0.6)';
    charts[canvasId] = new Chart(ctx, config);
  }

  function renderToolsChart(tools) {
    var canvasId = 'chart-tools';
    var ctx = el(canvasId).getContext('2d');
    var labels = tools.map(function (t) { return t.toolName; });
    var data = tools.map(function (t) { return Math.round(t.successRate * 1000) / 10; });
    var colors = tools.map(function (t) {
      if (t.successRate >= 0.8) return '#3fb27f';
      if (t.successRate >= 0.5) return '#d9a13b';
      return '#e05656';
    });

    var config = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ label: '成功率 %', data: data, backgroundColor: colors, borderRadius: 4 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { min: 0, max: 100, ticks: { color: '#8b93a3', callback: function (v) { return v + '%'; } }, grid: { color: 'rgba(38,43,54,0.6)' } },
          y: { ticks: { color: '#8b93a3' }, grid: { display: false } }
        }
      },
      plugins: [{
        id: 'bg2',
        beforeDraw: function (chart) {
          var c = chart.ctx;
          c.save();
          c.fillStyle = '#171a21';
          c.fillRect(0, 0, chart.width, chart.height);
          c.restore();
        }
      }]
    };

    if (charts[canvasId]) {
      charts[canvasId].data = config.data;
      charts[canvasId].update('none');
      return;
    }
    charts[canvasId] = new Chart(ctx, config);
  }

  function renderKpis(data) {
    var rl = data.rl || {};
    var loggerStats = rl.logger || {};
    var feedback = rl.dialogueFeedback || {};

    setText('kpi-experiences', String(rl.totalExperiences != null ? rl.totalExperiences : '—'));
    setText('kpi-episodes', String(loggerStats.totalEpisodes != null ? loggerStats.totalEpisodes : '—'));
    setText('kpi-reward', fmt(rl.averageReward));
    setText('kpi-success', pct(loggerStats.successRate != null ? loggerStats.successRate : rl.successRate));
    setText('kpi-updates', String(rl.totalUpdates != null ? rl.totalUpdates : '—'));
    setText('kpi-feedback', String(feedback.count != null ? feedback.count : '—'));
    setText('kpi-feedback-avg', feedback.count ? '平均质量 ' + fmt(feedback.averageQuality, 1) + '/10' : '');
  }

  /** 历史数据源徽标：persisted=数据库留存 / memory=内存回退 / empty=暂无数据 */
  function renderHistoryMeta(hist) {
    var badge = el('history-badge');
    if (!badge) return;
    var source = hist.source;
    var label, cls;
    if (source === 'persisted') {
      var t = hist.total || {};
      label = '🗄 数据库历史 ' + (t.trainEvents || 0) + ' 次训练 / ' + (t.episodes || 0) + ' 个 episode';
      cls = 'history-badge is-persisted';
    } else if (source === 'memory') {
      label = '⚡ 内存回退（本次进程）';
      cls = 'history-badge is-memory';
    } else {
      label = '暂无训练记录';
      cls = 'history-badge';
    }
    badge.textContent = label;
    badge.className = cls;
  }

  function renderCharts(data) {
    var hist = data.trainingHistory || {};
    var episodes = hist.episodes || [];
    var trainEvents = hist.trainEvents || [];

    renderHistoryMeta(hist);

    // Episode 奖励曲线（横轴 = 真实时间）
    renderLineChart(
      'chart-rewards',
      episodes.map(function (e) { return fmtAxis(e.t); }),
      [{
        label: '累计奖励',
        data: episodes.map(function (e) { return Math.round(e.reward * 100) / 100; }),
        borderColor: '#4f8cff',
        backgroundColor: 'rgba(79,140,255,0.15)',
        fill: true,
        tension: 0.25,
        pointRadius: 2
      }],
      { beginAtZero: false }
    );

    // Loss 曲线（横轴 = 真实时间）
    renderLineChart(
      'chart-loss',
      trainEvents.map(function (e) { return fmtAxis(e.t); }),
      [
        {
          label: 'policyLoss',
          data: trainEvents.map(function (e) { return Math.round(e.policyLoss * 1e4) / 1e4; }),
          borderColor: '#e05656',
          pointRadius: 1,
          tension: 0.2
        },
        {
          label: 'valueLoss',
          data: trainEvents.map(function (e) { return Math.round(e.valueLoss * 1e4) / 1e4; }),
          borderColor: '#d9a13b',
          pointRadius: 1,
          tension: 0.2
        }
      ]
    );

    // 熵（横轴 = 真实时间）
    renderLineChart(
      'chart-entropy',
      trainEvents.map(function (e) { return fmtAxis(e.t); }),
      [{
        label: 'entropy',
        data: trainEvents.map(function (e) { return Math.round(e.entropy * 1e4) / 1e4; }),
        borderColor: '#3fb27f',
        backgroundColor: 'rgba(63,178,127,0.12)',
        fill: true,
        pointRadius: 1,
        tension: 0.2
      }]
    );

    renderToolsChart(data.tools || []);
  }

  function renderTables(data) {
    var rl = data.rl || {};

    // 最近经验奖励
    var tbody = el('table-rewards').querySelector('tbody');
    tbody.innerHTML = '';
    var recent = rl.recentRewards || [];
    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="2" style="color:var(--text-dim)">暂无经验（对话或模拟训练后产生）</td></tr>';
    } else {
      recent.forEach(function (r, i) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' + (recent.length - i) + '</td><td class="' + (r >= 0 ? 'rate-good' : 'rate-bad') + '">' + fmt(r) + '</td>';
        tbody.appendChild(tr);
      });
    }

    // 评估器统计
    var tbody2 = el('table-dialogue').querySelector('tbody');
    tbody2.innerHTML = '';
    var d = data.dialogue || {};
    var rows = [
      ['追踪用户数', d.usersTracked != null ? d.usersTracked : '—'],
      ['质量评估次数', d.totalEvaluations != null ? d.totalEvaluations : '—'],
      ['流程分析次数', d.totalFlowAnalyses != null ? d.totalFlowAnalyses : '—']
    ];
    var tools = data.tools || [];
    rows.push(['已统计工具数', tools.length]);
    rows.push(['执行调用总数', tools.reduce(function (s, t) { return s + t.total; }, 0)]);
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + row[0] + '</td><td>' + row[1] + '</td>';
      tbody2.appendChild(tr);
    });
  }

  function render(data) {
    hideError();
    setText('generated-at', '更新于 ' + (data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : '—'));
    renderKpis(data);
    renderCharts(data);
    renderTables(data);
  }

  function load() {
    fetch('/api/dev/dashboard?limit=' + getLimit(), {
      headers: { 'X-Developer-Key': getKey() },
      cache: 'no-store'
    })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, status: res.status, body: body }; });
      })
      .then(function (r) {
        if (!r.ok) {
          var msg = r.body && r.body.message ? r.body.message : (r.body && r.body.error) || ('HTTP ' + r.status);
          if (r.status === 401) {
            msg = '开发者 API Key 无效或未提供。\n' + msg + '\n点击右上角「🔑 Key」填入 DEVELOPER_API_KEY。';
          } else if (r.status === 403) {
            msg = '开发者模式未启用或未配置 Key。\n' + msg + '\n请在后端 .env 设置 DEVELOPER_MODE=true 与 DEVELOPER_API_KEY=<自定义密钥>。';
          }
          showError(msg);
          return;
        }
        if (!r.body || !r.body.success) {
          showError('接口返回异常：' + JSON.stringify(r.body).slice(0, 300));
          return;
        }
        render(r.body.data);
      })
      .catch(function (e) {
        showError('请求失败：' + (e && e.message ? e.message : String(e)) + '\n请确认后端服务已启动。');
      });
  }

  function startAutoRefresh() {
    if (timer) clearInterval(timer);
    timer = setInterval(load, REFRESH_MS);
  }

  function stopAutoRefresh() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  // 事件绑定
  el('btn-refresh').addEventListener('click', load);
  el('auto-refresh').addEventListener('change', function (ev) {
    if (ev.target.checked) startAutoRefresh(); else stopAutoRefresh();
  });
  // 历史范围切换：持久化选择并立即重新拉取
  var rangeSel = el('history-range');
  rangeSel.value = String(getLimit());
  rangeSel.addEventListener('change', function (ev) {
    localStorage.setItem(LIMIT_STORAGE, ev.target.value);
    load();
  });

  var dialog = el('key-dialog');
  el('btn-key').addEventListener('click', function () {
    el('key-input').value = getKey();
    dialog.showModal();
  });
  el('key-cancel').addEventListener('click', function () { dialog.close(); });
  el('key-save').addEventListener('click', function () {
    var v = el('key-input').value.trim();
    if (v) localStorage.setItem(KEY_STORAGE, v); else localStorage.removeItem(KEY_STORAGE);
    dialog.close();
    load();
  });

  // 启动
  load();
  startAutoRefresh();
})();
