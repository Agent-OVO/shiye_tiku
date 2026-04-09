(function () {
  const data = window.__EXAM_BANK_DATA__;
  const appRoot = document.getElementById("app");
  const buildMeta = document.getElementById("build-meta");
  const collator = new Intl.Collator("zh-CN");

  if (!data || !Array.isArray(data.questions) || !Array.isArray(data.papers)) {
    appRoot.innerHTML = renderErrorState("题库数据不存在或格式不正确。");
    return;
  }

  const index = buildIndex(data);
  buildMeta.textContent = [
    `构建时间 ${formatDateTime(data.site.buildAt)}`,
    `${data.site.paperCount} 套试卷`,
    `${data.site.questionCount} 道题`,
    `${data.site.solvedCount || 0} 道已补答案`,
  ].join(" · ");

  if (!window.location.hash) {
    window.location.hash = "#/";
  }

  window.addEventListener("hashchange", handleRouteChange);
  handleRouteChange();

  function handleRouteChange() {
    const route = parseRoute();
    appRoot.innerHTML = renderRoute(route);
    bindPageEvents(route);
    updateNav(route);
    updateTitle(route);
    window.scrollTo(0, 0);
  }

  function buildIndex(siteData) {
    const questions = [...siteData.questions];
    const papers = [...siteData.papers];
    const topics = [...siteData.topics];
    const years = [...siteData.years].sort((a, b) => b - a);
    const modules = [...new Set(questions.map((item) => item.moduleName))].sort(collator.compare);

    const questionsDesc = [...questions].sort((a, b) => {
      return (
        b.examDate.localeCompare(a.examDate) ||
        collator.compare(a.paperTitle, b.paperTitle) ||
        a.questionNo - b.questionNo
      );
    });
    const papersDesc = [...papers].sort((a, b) => b.examDate.localeCompare(a.examDate) || collator.compare(a.title, b.title));
    const topicsByCount = [...topics].sort((a, b) => b.questionCount - a.questionCount || collator.compare(a.path, b.path));

    const questionMap = new Map(questions.map((item) => [item.id, item]));
    const paperMap = new Map(papers.map((item) => [item.id, item]));
    const topicMap = new Map(topics.map((item) => [item.path, item]));
    const topicQuestionsMap = new Map(
      topics.map((item) => [item.path, item.questionIds.map((questionId) => questionMap.get(questionId)).filter(Boolean)])
    );
    const topicGroupMap = new Map();

    topicsByCount.forEach((topic) => {
      const root = topic.parts[0] || "未分类";
      if (!topicGroupMap.has(root)) {
        topicGroupMap.set(root, []);
      }
      topicGroupMap.get(root).push(topic);
    });

    return {
      years,
      modules,
      questions,
      questionsDesc,
      questionMap,
      papers,
      papersDesc,
      paperMap,
      topics,
      topicsByCount,
      topicMap,
      topicQuestionsMap,
      topicGroupMap,
    };
  }

  function parseRoute() {
    const rawHash = window.location.hash.replace(/^#/, "") || "/";
    const [pathPart, queryString = ""] = rawHash.split("?");
    const normalizedPath = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
    const segments = normalizedPath.split("/").filter(Boolean).map(safeDecodeURIComponent);
    return {
      path: normalizedPath,
      segments,
      params: new URLSearchParams(queryString),
    };
  }

  function renderRoute(route) {
    const [section, arg] = route.segments;

    if (!section) {
      return renderHome();
    }
    if (section === "explore") {
      return renderExplore(route.params);
    }
    if (section === "papers") {
      return renderPapers();
    }
    if (section === "paper") {
      return renderPaperDetail(arg);
    }
    if (section === "topics") {
      return renderTopics();
    }
    if (section === "topic") {
      return renderTopicDetail(arg);
    }
    if (section === "question") {
      return renderQuestionDetail(arg);
    }
    return renderErrorState("未找到对应页面。");
  }

  function renderHome() {
    const topicCount = index.topics.length;
    const recentPapers = index.papersDesc.slice(0, 6);
    const hotTopics = index.topicsByCount.slice(0, 10);

    return `
      <section class="hero">
        <span class="hero-kicker">福建事业单位 · 静态发布版</span>
        <h1>把 Obsidian 题库发布成可交付的在线题库站</h1>
        <p>${escapeHtml(data.site.subtitle)}</p>
        <div class="hero-actions">
          <a class="button" href="#/explore">进入检索台</a>
          <a class="button-secondary" href="#/papers">按试卷浏览</a>
        </div>
      </section>

      <section class="stats-grid">
        ${renderStatCard("试卷总数", `${data.site.paperCount}`)}
        ${renderStatCard("题目总量", `${data.site.questionCount}`)}
        ${renderStatCard("已补解析", `${data.site.solvedCount || 0}`)}
        ${renderStatCard("覆盖年份", `${data.site.yearCount}`)}
        ${renderStatCard("题型路径", `${topicCount}`)}
      </section>

      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>快速检索</h2>
            <p>支持关键词、年份、试卷、模块和题型路径组合筛选。</p>
          </div>
        </div>
        <form data-home-search class="filter-grid">
          <div class="field">
            <label for="home-query">关键词</label>
            <input id="home-query" name="q" type="text" placeholder="例如：马克思主义、资料分析、重要会议讲话">
          </div>
          <div class="field">
            <label for="home-year">年份</label>
            <select id="home-year" name="year">
              <option value="">全部年份</option>
              ${renderOptions(index.years.map((year) => ({ value: String(year), label: `${year}` })))}
            </select>
          </div>
          <div class="field">
            <label for="home-module">模块</label>
            <select id="home-module" name="module">
              <option value="">全部模块</option>
              ${renderOptions(index.modules.map((name) => ({ value: name, label: name })))}
            </select>
          </div>
          <div class="inline-actions">
            <button class="button-link" type="submit">开始检索</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>最近试卷</h2>
            <p>按考试日期倒序展示，方便快速跳入单卷学习。</p>
          </div>
          <a class="button-link" href="#/papers">查看全部试卷</a>
        </div>
        <div class="card-grid">
          ${recentPapers.map((paper) => renderPaperCard(paper)).join("")}
        </div>
      </section>

      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>高频题型</h2>
            <p>跨卷聚合后优先出现的题型路径，适合先建立题型框架。</p>
          </div>
          <a class="button-link" href="#/topics">进入题型库</a>
        </div>
        <div class="card-grid">
          ${hotTopics.map((topic) => renderTopicCard(topic)).join("")}
        </div>
      </section>
    `;
  }

  function renderPapers() {
    return `
      <section class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Papers</p>
            <h2>全部试卷</h2>
            <p>每套卷都保留自己的题目顺序，同时共享跨卷题型索引。</p>
          </div>
        </div>
        <div class="card-grid">
          ${index.papersDesc.map((paper) => renderPaperCard(paper)).join("")}
        </div>
      </section>
    `;
  }

  function renderPaperDetail(paperId) {
    const paper = index.paperMap.get(paperId);
    if (!paper) {
      return renderErrorState("未找到对应试卷。");
    }
    const questions = paper.questionIds.map((questionId) => index.questionMap.get(questionId)).filter(Boolean);

    return `
      <section class="panel">
        <div class="breadcrumbs">
          <a href="#/">首页</a>
          <span>／</span>
          <a href="#/papers">试卷</a>
          <span>／</span>
          <span>${escapeHtml(paper.title)}</span>
        </div>
        <h1 class="detail-title">${escapeHtml(paper.title)}</h1>
        <p class="detail-subtitle">${escapeHtml(paper.province)} · ${escapeHtml(paper.cityOrScope)} · ${escapeHtml(paper.examName)} · ${escapeHtml(paper.subject)}</p>
        <div class="badge-row">
          <span class="badge">${escapeHtml(formatDate(paper.examDate))}</span>
          <span class="badge">${paper.totalQuestions} 题</span>
          <span class="badge">${paper.year} 年</span>
          <span class="badge">${escapeHtml(paper.source)}</span>
        </div>
      </section>

      <section class="panel-grid">
        <section class="panel">
          <div class="section-heading">
            <div>
              <h2>题目列表</h2>
              <p>保持卷内顺序，适合整套过题。</p>
            </div>
            <a class="button-link" href="${buildHash("/explore", { paper: paper.id })}">在检索台打开</a>
          </div>
          <div class="question-list">
            ${questions.map((question) => renderQuestionCard(question, { showPaper: false })).join("")}
          </div>
        </section>
        <aside class="panel surface-muted">
          <h3>卷内概览</h3>
          <div class="meta-list">
            <div class="meta-item"><strong>总题量</strong><span>${paper.totalQuestions} 题</span></div>
            <div class="meta-item"><strong>模块分布</strong><span>${escapeHtml(formatModuleSummary(paper.moduleSummary))}</span></div>
            <div class="meta-item"><strong>高频题型</strong><span>${escapeHtml(formatTopTopics(paper.topTopics))}</span></div>
          </div>
        </aside>
      </section>
    `;
  }

  function renderTopics() {
    const sections = [...index.topicGroupMap.entries()].map(([groupName, topics]) => {
      return `
        <section class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Topic Group</p>
              <h2>${escapeHtml(groupName)}</h2>
              <p>按跨卷题型路径聚合，方便横向对比不同年份的同类题。</p>
            </div>
          </div>
          <div class="card-grid">
            ${topics.map((topic) => renderTopicCard(topic)).join("")}
          </div>
        </section>
      `;
    });
    return sections.join("");
  }

  function renderTopicDetail(topicPath) {
    const topic = index.topicMap.get(topicPath);
    if (!topic) {
      return renderErrorState("未找到对应题型路径。");
    }
    const questions = (index.topicQuestionsMap.get(topic.path) || []).slice().sort((a, b) => {
      return b.examDate.localeCompare(a.examDate) || collator.compare(a.paperTitle, b.paperTitle) || a.questionNo - b.questionNo;
    });

    return `
      <section class="panel">
        <div class="breadcrumbs">
          <a href="#/">首页</a>
          <span>／</span>
          <a href="#/topics">题型</a>
          <span>／</span>
          <span>${escapeHtml(topic.path)}</span>
        </div>
        <h1 class="detail-title">${escapeHtml(topic.parts[topic.parts.length - 1] || topic.path)}</h1>
        <p class="detail-subtitle">${escapeHtml(topic.path)}</p>
        <div class="badge-row">
          <span class="badge">${topic.questionCount} 题</span>
          <span class="badge">${topic.paperCount} 套卷</span>
          <span class="badge">${escapeHtml(topic.years.join(" / "))}</span>
        </div>
      </section>

      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>同题型题目</h2>
            <p>这里展示跨年份、跨试卷的同路径题目，适合做题型串联。</p>
          </div>
          <a class="button-link" href="${buildHash("/explore", { topic: topic.path })}">在检索台筛到这里</a>
        </div>
        <div class="question-list">
          ${questions.map((question) => renderQuestionCard(question)).join("")}
        </div>
      </section>
    `;
  }

  function renderExplore(params) {
    const filters = {
      q: (params.get("q") || "").trim(),
      year: (params.get("year") || "").trim(),
      module: (params.get("module") || "").trim(),
      paper: (params.get("paper") || "").trim(),
      topic: (params.get("topic") || "").trim(),
    };
    const results = filterQuestions(filters);

    return `
      <section class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Explorer</p>
            <h2>检索台</h2>
            <p>面向交付场景的统一入口。搜索、年份、模块、试卷、题型路径都在这里收敛。</p>
          </div>
        </div>
      </section>

      <section class="filter-panel">
        <form data-explore-form>
          <div class="filter-grid">
            <div class="field">
              <label for="explore-q">关键词</label>
              <input id="explore-q" name="q" type="text" value="${escapeAttribute(filters.q)}" placeholder="搜索题干、选项、试卷名、题型">
            </div>
            <div class="field">
              <label for="explore-year">年份</label>
              <select id="explore-year" name="year">
                <option value="">全部年份</option>
                ${renderOptions(index.years.map((year) => ({ value: String(year), label: `${year}` })), filters.year)}
              </select>
            </div>
            <div class="field">
              <label for="explore-module">模块</label>
              <select id="explore-module" name="module">
                <option value="">全部模块</option>
                ${renderOptions(index.modules.map((name) => ({ value: name, label: name })), filters.module)}
              </select>
            </div>
            <div class="field">
              <label for="explore-paper">试卷</label>
              <select id="explore-paper" name="paper">
                <option value="">全部试卷</option>
                ${renderOptions(index.papersDesc.map((paper) => ({ value: paper.id, label: paper.title })), filters.paper)}
              </select>
            </div>
            <div class="field">
              <label for="explore-topic">题型路径</label>
              <select id="explore-topic" name="topic">
                <option value="">全部题型</option>
                ${renderOptions(index.topicsByCount.map((topic) => ({ value: topic.path, label: `${topic.path}（${topic.questionCount}）` })), filters.topic)}
              </select>
            </div>
          </div>
          <div class="inline-actions">
            <button class="button-link" type="submit">应用筛选</button>
            <button class="button-link" type="button" data-clear-explore>清空条件</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="results-summary">
          <div>
            <h2>结果列表</h2>
            <p class="helper-text">当前命中 ${results.length} 题。</p>
          </div>
          ${renderAppliedFilters(filters)}
        </div>
        ${results.length ? `<div class="question-list">${results.map((question) => renderQuestionCard(question)).join("")}</div>` : renderEmptyState("当前条件下没有找到题目。")}
      </section>
    `;
  }

  function renderQuestionDetail(questionId) {
    const question = index.questionMap.get(questionId);
    if (!question) {
      return renderErrorState("未找到对应题目。");
    }

    const paper = index.paperMap.get(question.paperId);
    const relatedQuestions = (index.topicQuestionsMap.get(question.classificationPath) || [])
      .filter((item) => item.id !== question.id)
      .slice(0, 8);
    const answerLabel = question.answer ? `参考答案 ${question.answer}` : "暂未补全答案";

    return `
      <section class="panel">
        <div class="breadcrumbs">
          <a href="#/">首页</a>
          <span>／</span>
          <a href="#/papers">试卷</a>
          <span>／</span>
          <a href="#/paper/${encodeURIComponent(question.paperId)}">${escapeHtml(question.paperTitle)}</a>
          <span>／</span>
          <span>${escapeHtml(question.title)}</span>
        </div>
        <h1 class="detail-title">${escapeHtml(question.title)}</h1>
        <p class="detail-subtitle">${escapeHtml(question.paperTitle)} · ${escapeHtml(question.moduleName)} · ${escapeHtml(question.classificationPath)}</p>
        <div class="badge-row">
          <span class="badge">${question.year} 年</span>
          <span class="badge">${escapeHtml(formatDate(question.examDate))}</span>
          <span class="badge">${escapeHtml(question.moduleName)}</span>
          <span class="badge">${escapeHtml(question.displayTag)}</span>
          ${question.hasSharedMaterial ? `<span class="chip">含共享材料</span>` : ""}
          ${question.hasImage ? `<span class="chip">含图片</span>` : ""}
        </div>
      </section>

      <section class="question-layout">
        <div class="app-root">
          ${question.materialHtml ? `
            <section class="panel">
              <div class="section-heading">
                <div>
                  <h2>材料原文</h2>
                  <p>该材料与当前题型对应的共享材料一起保留。</p>
                </div>
              </div>
              <div class="content-block">${question.materialHtml}</div>
            </section>
          ` : ""}

          <section class="panel">
            <div class="section-heading">
              <div>
                <h2>题目原文</h2>
                <p>保留原题排版，并补入粉笔题库检索到的参考答案与解析。</p>
              </div>
            </div>
            <div class="content-block">${question.questionHtml || `<p>${escapeHtml(question.questionText || "暂无题目内容。")}</p>`}</div>
          </section>

          <section class="panel">
            <div class="section-heading">
              <div>
                <h2>参考答案与解析</h2>
                <p>答案和解析来自粉笔站内检索结果，保留为题库内的参考信息。</p>
              </div>
            </div>
            <div class="answer-highlight">
              <span class="answer-label">参考答案</span>
              <span class="answer-value">${escapeHtml(question.answer || "待补全")}</span>
            </div>
            ${question.analysisHtml ? `<div class="content-block">${question.analysisHtml}</div>` : `<p class="helper-text">当前题目暂未抓到解析。</p>`}
            ${question.solutionSource ? `<p class="source-note">题源：${escapeHtml(question.solutionSource)}</p>` : ""}
            ${question.solutionUpdatedAt ? `<p class="source-note">抓取时间：${escapeHtml(formatDateTime(question.solutionUpdatedAt))}</p>` : ""}
          </section>

          <section class="panel">
            <div class="section-heading">
              <div>
                <h2>同题型延伸</h2>
                <p>从跨卷聚合视角继续做同路径题目。</p>
              </div>
              <a class="button-link" href="#/topic/${encodeURIComponent(question.classificationPath)}">进入题型页</a>
            </div>
            ${relatedQuestions.length ? `<div class="question-list">${relatedQuestions.map((item) => renderQuestionCard(item)).join("")}</div>` : renderEmptyState("当前题型下暂无更多题目。")}
          </section>
        </div>

        <aside class="app-root">
          <section class="panel surface-muted">
            <h3>题目信息</h3>
            <div class="meta-list">
              <div class="meta-item"><strong>所属试卷</strong><span>${escapeHtml(question.paperTitle)}</span></div>
              <div class="meta-item"><strong>题号</strong><span>第 ${padQuestionNo(question.questionNo)} 题</span></div>
              <div class="meta-item"><strong>参考答案</strong><span>${escapeHtml(answerLabel)}</span></div>
              <div class="meta-item"><strong>年份</strong><span>${question.year}</span></div>
              <div class="meta-item"><strong>地区</strong><span>${escapeHtml(question.province)}</span></div>
              <div class="meta-item"><strong>模块</strong><span>${escapeHtml(question.moduleName)}</span></div>
              <div class="meta-item"><strong>题型路径</strong><span>${escapeHtml(question.classificationPath)}</span></div>
            </div>
          </section>

          <section class="panel">
            <h3>跳转</h3>
            <div class="question-actions">
              <a class="button-link" href="#/paper/${encodeURIComponent(question.paperId)}">返回试卷</a>
              <a class="button-link" href="${buildHash("/explore", { topic: question.classificationPath })}">筛到同题型</a>
            </div>
            <div class="pagination-links">
              ${question.prevQuestionId ? `<a class="button-link" href="#/question/${encodeURIComponent(question.prevQuestionId)}">上一题</a>` : ""}
              ${question.nextQuestionId ? `<a class="button-link" href="#/question/${encodeURIComponent(question.nextQuestionId)}">下一题</a>` : ""}
            </div>
            ${paper ? `<p class="helper-text">当前题目属于 ${escapeHtml(paper.title)}。</p>` : ""}
          </section>
        </aside>
      </section>
    `;
  }

  function filterQuestions(filters) {
    const q = normalizeSearchText(filters.q);
    return index.questionsDesc.filter((question) => {
      if (filters.year && String(question.year) !== String(filters.year)) {
        return false;
      }
      if (filters.module && question.moduleName !== filters.module) {
        return false;
      }
      if (filters.paper && question.paperId !== filters.paper) {
        return false;
      }
      if (filters.topic && question.classificationPath !== filters.topic) {
        return false;
      }
      if (q && !normalizeSearchText(question.searchText).includes(q)) {
        return false;
      }
      return true;
    });
  }

  function bindPageEvents(route) {
    const homeForm = appRoot.querySelector("[data-home-search]");
    if (homeForm) {
      homeForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const formData = new FormData(homeForm);
        setHash("/explore", {
          q: formData.get("q"),
          year: formData.get("year"),
          module: formData.get("module"),
        });
      });
    }

    const exploreForm = appRoot.querySelector("[data-explore-form]");
    if (exploreForm) {
      exploreForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const formData = new FormData(exploreForm);
        setHash("/explore", {
          q: formData.get("q"),
          year: formData.get("year"),
          module: formData.get("module"),
          paper: formData.get("paper"),
          topic: formData.get("topic"),
        });
      });
      const clearButton = appRoot.querySelector("[data-clear-explore]");
      if (clearButton) {
        clearButton.addEventListener("click", function () {
          setHash("/explore", {});
        });
      }
    }
  }

  function updateNav(route) {
    const current = route.segments[0] || "";
    const activeRoot = current === "paper" ? "papers" : current === "topic" ? "topics" : current;
    document.querySelectorAll("[data-nav-link]").forEach((link) => {
      const target = link.getAttribute("href") || "#/";
      const normalized = target.replace(/^#\//, "").split("/")[0];
      const isActive = (!normalized && !activeRoot) || normalized === activeRoot;
      link.classList.toggle("is-active", isActive);
    });
  }

  function updateTitle(route) {
    const [section, arg] = route.segments;
    let title = data.site.title;

    if (!section) {
      title = data.site.title;
    } else if (section === "explore") {
      title = "检索台";
    } else if (section === "papers") {
      title = "全部试卷";
    } else if (section === "paper" && index.paperMap.get(arg)) {
      title = index.paperMap.get(arg).title;
    } else if (section === "topics") {
      title = "题型库";
    } else if (section === "topic" && index.topicMap.get(arg || "")) {
      title = index.topicMap.get(arg).path;
    } else if (section === "question" && index.questionMap.get(arg)) {
      title = index.questionMap.get(arg).title;
    }
    document.title = `${title} | ${data.site.title}`;
  }

  function renderPaperCard(paper) {
    return `
      <a class="card" href="#/paper/${encodeURIComponent(paper.id)}">
        <div class="badge-row">
          <span class="badge">${paper.year} 年</span>
          <span class="badge">${paper.totalQuestions} 题</span>
        </div>
        <h3 class="card-title">${escapeHtml(paper.title)}</h3>
        <p>${escapeHtml(`${paper.cityOrScope} · ${paper.examName} · ${paper.subject}`)}</p>
        <div class="tag-row">
          ${paper.topTopics.slice(0, 3).map((topic) => `<span class="tag">${escapeHtml(`${topic.displayTag} × ${topic.count}`)}</span>`).join("")}
        </div>
      </a>
    `;
  }

  function renderTopicCard(topic) {
    return `
      <a class="topic-card" href="#/topic/${encodeURIComponent(topic.path)}">
        <div class="badge-row">
          <span class="badge">${topic.questionCount} 题</span>
          <span class="badge">${topic.paperCount} 套卷</span>
        </div>
        <h3 class="topic-title">${escapeHtml(topic.parts[topic.parts.length - 1] || topic.path)}</h3>
        <p>${escapeHtml(topic.path)}</p>
        <div class="tag-row">
          ${topic.years.map((year) => `<span class="tag">${year}</span>`).join("")}
        </div>
      </a>
    `;
  }

  function renderQuestionCard(question, options) {
    const settings = Object.assign({ showPaper: true }, options || {});
    return `
      <a class="question-card" href="#/question/${encodeURIComponent(question.id)}">
        <div class="badge-row">
          <span class="badge">第 ${padQuestionNo(question.questionNo)} 题</span>
          <span class="badge">${question.year} 年</span>
          <span class="badge">${escapeHtml(question.moduleName)}</span>
        </div>
        <h3 class="question-card-title">${escapeHtml(question.displayTag)}</h3>
        <p>${escapeHtml(question.preview)}</p>
        <div class="tag-row">
          ${settings.showPaper ? `<span class="tag">${escapeHtml(question.paperTitle)}</span>` : ""}
          <span class="tag">${escapeHtml(question.classificationPath)}</span>
        </div>
      </a>
    `;
  }

  function renderAppliedFilters(filters) {
    const items = [];
    if (filters.q) items.push(`关键词：${filters.q}`);
    if (filters.year) items.push(`年份：${filters.year}`);
    if (filters.module) items.push(`模块：${filters.module}`);
    if (filters.paper && index.paperMap.get(filters.paper)) items.push(`试卷：${index.paperMap.get(filters.paper).title}`);
    if (filters.topic) items.push(`题型：${filters.topic}`);

    return items.length
      ? `<div class="tag-row">${items.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div>`
      : `<p class="helper-text">当前未设置筛选条件，展示全部题目。</p>`;
  }

  function renderStatCard(label, value) {
    return `<article class="stat-card"><div class="stat-label">${escapeHtml(label)}</div><div class="stat-value">${escapeHtml(value)}</div></article>`;
  }

  function renderOptions(items, selectedValue) {
    return items
      .map((item) => {
        const selected = String(item.value) === String(selectedValue || "") ? " selected" : "";
        return `<option value="${escapeAttribute(item.value)}"${selected}>${escapeHtml(item.label)}</option>`;
      })
      .join("");
  }

  function renderEmptyState(message) {
    return `<div class="empty-state"><p>${escapeHtml(message)}</p></div>`;
  }

  function renderErrorState(message) {
    return `<section class="error-state"><h2>页面不可用</h2><p>${escapeHtml(message)}</p><a class="button-link" href="#/">返回首页</a></section>`;
  }

  function formatModuleSummary(moduleSummary) {
    return moduleSummary.map((item) => `${item.moduleName} ${item.count}`).join(" / ");
  }

  function formatTopTopics(topTopics) {
    return topTopics.slice(0, 4).map((item) => `${item.displayTag} ${item.count}`).join(" / ");
  }

  function setHash(path, paramsObj) {
    window.location.hash = buildHash(path, paramsObj);
  }

  function buildHash(path, paramsObj) {
    const params = new URLSearchParams();
    Object.entries(paramsObj || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        params.set(key, String(value));
      }
    });
    const query = params.toString();
    return `#${path}${query ? `?${query}` : ""}`;
  }

  function safeDecodeURIComponent(value) {
    try {
      return decodeURIComponent(value || "");
    } catch (error) {
      return value || "";
    }
  }

  function formatDate(dateValue) {
    return dateValue || "";
  }

  function formatDateTime(value) {
    if (!value) return "";
    return value.replace("T", " ");
  }

  function padQuestionNo(no) {
    return String(no).padStart(3, "0");
  }

  function normalizeSearchText(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }
})();
