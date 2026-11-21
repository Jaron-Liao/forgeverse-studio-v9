/* 创作向导 · 30 问数据层（v10 融合）
   来源：workbench 30 问生成器的章节/题库结构，按 ForgeVerse 真实能力重写。
   约束：每题必须有安全默认值（DEFAULTS），未作答也能直接进入工作台。 */

export const CHAPTERS = [
  { id: 'who',   name: '认识你', icon: '🌱', hint: '先搞清楚这块工作区服务谁、什么时候用' },
  { id: 'rooms', name: '工作区', icon: '🧱', hint: '决定主界面摆哪些面板、留多少信息' },
  { id: 'skin',  name: '外观',   icon: '🎨', hint: 'WorkBuddy 绿系里挑一套顺眼的' },
  { id: 'play',  name: '玩法',   icon: '🎮', hint: '经验、徽章、连击与奖励，按需开启' },
  { id: 'tune',  name: '调参',   icon: '🎚️', hint: '最后拧几个旋钮：首屏、任务、生态、名字' }
];

export const QUESTIONS = [
  /* ===== 第一章 · 认识你（6）===== */
  {
    id: 'scene', chapter: 'who', type: 'single', required: true,
    title: '这块 3D 工作台，主要服务你哪个战场？',
    sub: '选一个最常出现的场景，后面的面板与任务模板都围着它转',
    options: [
      { v: 'work',   e: '💼', l: '工作项目', d: '需求、排期、交付，一堆事要推' },
      { v: 'study',  e: '📚', l: '学习创作', d: '建模练习、课程作业、作品集' },
      { v: 'life',   e: '🏠', l: '生活整理', d: '房间规划、收藏清单、日常杂事' },
      { v: 'indie',  e: '🕹️', l: '独立游戏', d: '关卡、场景、素材，一个人全包' },
      { v: 'team',   e: '👥', l: '团队协作', d: '和别人一起推进同一个世界' },
      { v: 'all',    e: '🌈', l: '综合全能', d: '什么都造，什么都想管' }
    ]
  },
  {
    id: 'timeband', chapter: 'who', type: 'single',
    title: '你一天里最常打开它的是什么时候？',
    sub: '决定默认时段与天空光线的起点',
    options: [
      { v: 'morning', e: '🌅', l: '清晨', d: '起来先排个队' },
      { v: 'noon',    e: '☀️', l: '上午', d: '开工第一件事' },
      { v: 'pm',      e: '🌤️', l: '下午', d: '中途校准方向' },
      { v: 'night',   e: '🌙', l: '夜晚', d: '收工前复盘' },
      { v: 'deep',    e: '🦉', l: '深夜', d: '夜猫子专属时段' },
      { v: 'any',     e: '⚡', l: '全天碎片', d: '想到就开一下' }
    ]
  },
  {
    id: 'pain', chapter: 'who', type: 'single',
    title: '说实话，现在最头疼的是哪件事？',
    sub: '工作台会针对这个痛点加压或减负',
    options: [
      { v: 'delay',    e: '🐌', l: '拖延启动', d: '知道要干，就是不动' },
      { v: 'forget',   e: '🧠', l: '总是忘事', d: '脑子装不下那么多' },
      { v: 'focus',    e: '📱', l: '容易分心', d: '一刷手机两小时没了' },
      { v: 'nofb',     e: '🫥', l: '没有反馈', d: '做了也没成就感' },
      { v: 'mess',     e: '🌀', l: '场景太杂', d: '模型、笔记、任务混在一起' },
      { v: 'noreview', e: '🪞', l: '从不复盘', d: '忙了一周不知道忙了啥' }
    ]
  },
  {
    id: 'role', chapter: 'who', type: 'single',
    title: '你希望造物精灵扮演什么角色？',
    sub: '决定它跟你说话的语气',
    options: [
      { v: 'drill',   e: '🗣️', l: '严厉教官', d: '别废话，干就完了' },
      { v: 'soft',    e: '🧸', l: '温柔伙伴', d: '累了就歇会儿，我陪你' },
      { v: 'tool',    e: '🔧', l: '沉默工具', d: '别说话，安静干活' },
      { v: 'leader',  e: '🚩', l: '游戏领队', d: '来，今天冲个副本' },
      { v: 'analyst', e: '📊', l: '数据参谋', d: '你的面数又在涨了' },
      { v: 'scribe',  e: '📔', l: '安静记录员', d: '只负责把事记下来' }
    ]
  },
  {
    id: 'device', chapter: 'who', type: 'single',
    title: '你的主战场是哪块屏幕？',
    sub: '决定默认画质档位与面板密度',
    options: [
      { v: 'big',    e: '🖥️', l: '大屏显示器', d: '空间管够，铺开摆' },
      { v: 'laptop', e: '💻', l: '笔记本', d: '常规尺寸' },
      { v: 'pad',    e: '📱', l: '平板', d: '触摸优先，大按钮' },
      { v: 'phone',  e: '📲', l: '手机', d: '单列纵向流' },
      { v: 'multi',  e: '🔄', l: '多端来回切', d: '要自适应' }
    ]
  },
  {
    id: 'budget', chapter: 'who', type: 'single',
    title: '你愿意每天花多少时间维护它？',
    sub: '时间少 → 少提示多自动化；时间多 → 给你更多手动控制',
    options: [
      { v: '3',  e: '⏱️', l: '3 分钟以内', d: '只看一眼，勾两下' },
      { v: '10', e: '🕐', l: '10 分钟左右', d: '早晚各收拾一次' },
      { v: '30', e: '🕒', l: '30 分钟', d: '认真规划 + 复盘' },
      { v: '60', e: '🕰️', l: '1 小时以上', d: '它是我的主工作区' }
    ]
  },

  /* ===== 第二章 · 工作区（6）===== */
  {
    id: 'core', chapter: 'rooms', type: 'multi', max: 4, required: true,
    title: '核心面板：哪几块是必须的？（最多 4 个）',
    sub: '这几块会常驻主界面，其余可以随时用手动「面板」菜单重开',
    options: [
      { v: 'assets',    e: '🧰', l: '资产库', d: '基础体 / 几何体 / 场景物件' },
      { v: 'inspector', e: '🎛️', l: '检查器', d: '位置旋转缩放 + 材质' },
      { v: 'console',   e: '⚔', l: '操作台', d: '任务、笔记、天气、小地图' },
      { v: 'search',    e: '🔍', l: '全局搜索', d: '物体 / 任务 / 笔记一把抓' },
      { v: 'hud',       e: '📈', l: '性能 HUD', d: 'FPS / 面数 / 画质' },
      { v: 'minimap',   e: '🗺️', l: '小地图', d: '随时知道自己在哪' }
    ]
  },
  {
    id: 'extra', chapter: 'rooms', type: 'multi', max: 3,
    title: '还想要哪些附加能力？（最多 3 个）',
    sub: '排在核心之后，按需开启，不会默认占满屏幕',
    options: [
      { v: 'kanban',  e: '🗂️', l: '看板视图', d: '待办 / 进行 / 完成' },
      { v: 'stat',    e: '📊', l: '数据统计', d: '完成率、趋势图' },
      { v: 'mood',    e: '🫧', l: '情绪记录', d: '今天状态几分' },
      { v: 'idea',    e: '💡', l: '灵感收集箱', d: '想法先扔进来' },
      { v: 'file',    e: '🔗', l: '资料 / 链接库', d: '常用入口收一起' },
      { v: 'journal', e: '🪞', l: '复盘日记', d: '一天一句总结' }
    ]
  },
  {
    id: 'statdepth', chapter: 'rooms', type: 'single',
    title: '性能与进度信息，你想看多深？',
    sub: '越深，HUD 与统计占的地方越多',
    options: [
      { v: 'lite',  e: '🎚️', l: '只要帧率', d: '一个数字就够' },
      { v: 'week',  e: '📈', l: '周报图表', d: '七天完成柱状图' },
      { v: 'heat',  e: '🔥', l: '热力图', d: '像 GitHub 那种格子' },
      { v: 'trend', e: '🔮', l: '趋势预测', d: '照这速度何时达标' },
      { v: 'full',  e: '🧿', l: '全维度看板', d: '面数、物体、耗时都算' }
    ]
  },
  {
    id: 'remind', chapter: 'rooms', type: 'single',
    title: '希望它怎么提醒你？',
    sub: '选一种不让人烦躁的方式',
    options: [
      { v: 'none',   e: '🔇', l: '别提醒我', d: '我自己会看' },
      { v: 'anim',   e: '✨', l: '界面小动画', d: '角落动一下' },
      { v: 'pet',    e: '💬', l: '精灵对话', d: '小家伙来叨叨' },
      { v: 'sound',  e: '🔔', l: '轻提示音', d: '叮的一声' },
      { v: 'notify', e: '🪟', l: '桌面通知', d: '系统弹窗' }
    ]
  },
  {
    id: 'storage', chapter: 'rooms', type: 'single',
    title: '作品数据放哪儿？',
    sub: '当前版本默认浏览器本地存档，云同步需要登录',
    options: [
      { v: 'local',  e: '💾', l: '本地浏览器', d: '快，换设备就没了' },
      { v: 'export', e: '📤', l: '本地 + 可导出', d: '随时存成 JSON 文件' },
      { v: 'cloud',  e: '☁️', l: '希望云同步', d: '登录后自动同步' }
    ]
  },
  {
    id: 'people', chapter: 'rooms', type: 'single',
    title: '有别人要用这个世界吗？',
    sub: '决定要不要开启云同步与共享入口',
    options: [
      { v: 'solo', e: '🧍', l: '就我一个人', d: '纯私人领地' },
      { v: 'duo',  e: '🧑‍🤝‍🧑', l: '两个人', d: '和搭子一起' },
      { v: 'team', e: '👥', l: '小队 3-8 人', d: '需要分工' },
      { v: 'org',  e: '🏢', l: '更大团队', d: '需要角色权限' }
    ]
  },

  /* ===== 第三章 · 外观（6）===== */
  {
    id: 'palette', chapter: 'skin', type: 'single',
    title: '绿系主色，凭第一感觉挑一个',
    sub: '全部落在 WorkBuddy 绿色家族内，全局变量统一替换',
    options: [
      { v: 'emerald', e: '💚', l: '翡翠绿', d: 'WorkBuddy 品牌默认' },
      { v: 'mint',    e: '🍃', l: '薄荷绿', d: '更亮、更轻盈' },
      { v: 'forest',  e: '🌲', l: '森林绿', d: '更沉、更专注' },
      { v: 'jade',    e: '🪻', l: '青玉绿', d: '带一点科技青' },
      { v: 'moss',    e: '🌿', l: '苔石绿', d: '自然、偏低饱和' },
      { v: 'pine',    e: '🫒', l: '松针绿', d: '接近墨绿，夜里也稳' }
    ]
  },
  {
    id: 'pet', chapter: 'skin', type: 'single',
    title: '挑一只陪你在场景里干活的精灵',
    sub: '它会住在右下角，负责卖萌和唠叨',
    options: [
      { v: 'dragon', e: '🐲', l: '造物龙', d: '元气满满，最经典的搭档' },
      { v: 'fox',    e: '🦊', l: '灵狐', d: '机灵，爱提点子' },
      { v: 'panda',  e: '🐼', l: '团子熊猫', d: '慵懒但靠谱' },
      { v: 'frog',   e: '🐸', l: '泡泡蛙', d: 'Q 弹，负责缓解焦虑' },
      { v: 'owl',    e: '🦉', l: '守夜鸮', d: '夜猫子专属，安静报数据' },
      { v: 'robot',  e: '🤖', l: '小铁皮', d: '逻辑怪，只说事实' }
    ]
  },
  {
    id: 'texture', chapter: 'skin', type: 'single',
    title: '整体质感喜欢哪种？',
    sub: '圆角、阴影、边框的风格，可随时换',
    options: [
      { v: 'soft',   e: '🍡', l: '圆润软糖', d: '大圆角 + 软阴影' },
      { v: 'flat',   e: '📐', l: '简约线条', d: '细边框，不说废话' },
      { v: 'glass',  e: '🪟', l: '玻璃拟态', d: '毛玻璃通透' },
      { v: 'pixel',  e: '👾', l: '像素复古', d: '硬边框 + 点阵感' },
      { v: 'doodle', e: '🖍️', l: '手绘涂鸦', d: '歪歪扭扭的可爱' }
    ]
  },
  {
    id: 'light', chapter: 'skin', type: 'single',
    title: '明暗模式？',
    sub: '也可以让它跟着时间自动变',
    options: [
      { v: 'day',   e: '🌞', l: '明亮日间', d: '清爽提神' },
      { v: 'dusk',  e: '🌇', l: '温暖黄昏', d: '柔和护眼' },
      { v: 'night', e: '🌚', l: '深邃夜间', d: '沉浸不刺眼' },
      { v: 'auto',  e: '🔆', l: '自动切换', d: '白天亮，晚上暗' }
    ]
  },
  {
    id: 'motion', chapter: 'skin', type: 'single',
    title: '动效强度调到几档？',
    sub: '太花会晕，太少会闷；只影响过渡与入场动画',
    options: [
      { v: 'calm',    e: '🫙', l: '几乎不动', d: '只保留必要反馈' },
      { v: 'normal',  e: '🚶', l: '轻微', d: 'hover 抬一下就行' },
      { v: 'playful', e: '🕺', l: '活泼', d: '弹跳、飘点小星星' },
      { v: 'max',     e: '🎆', l: '满屏特效', d: '升级撒花、全屏庆祝' }
    ]
  },
  {
    id: 'density', chapter: 'skin', type: 'single',
    title: '一屏想塞多少信息？',
    sub: '信息密度直接影响焦虑程度',
    options: [
      { v: 'one',   e: '🕳️', l: '一屏一件事', d: '极简，只盯当前' },
      { v: 'three', e: '▦', l: '舒适三栏', d: '推荐，一眼扫完' },
      { v: 'dense', e: '🧿', l: '密集仪表盘', d: '信息全都要' }
    ]
  },

  /* ===== 第四章 · 玩法（6）===== */
  {
    id: 'xp', chapter: 'play', type: 'single',
    title: '要不要经验等级系统？',
    sub: '完成任务涨经验，升级有反馈；关掉则隐藏底部经验条',
    options: [
      { v: 'yes', e: '⭐', l: '要，我想看到成长', d: '等级条常驻底部' },
      { v: 'no',  e: '🚫', l: '不要，太吵了', d: '隐藏等级与经验条' }
    ]
  },
  {
    id: 'badge', chapter: 'play', type: 'single',
    title: '成就徽章呢？',
    sub: '达成条件解锁一枚，弹出一次提示',
    options: [
      { v: 'yes', e: '🏅', l: '要，收集癖发作', d: '解锁有提示' },
      { v: 'no',  e: '🚫', l: '不要', d: '省点地方' }
    ]
  },
  {
    id: 'combo', chapter: 'play', type: 'single',
    title: '连续打卡连击（streak）？',
    sub: '断了会归零，压力与动力并存',
    options: [
      { v: 'yes', e: '🔥', l: '要，断了心疼', d: '火焰计数常驻' },
      { v: 'no',  e: '🚫', l: '不要，断了更摆烂', d: '不显示连击' }
    ]
  },
  {
    id: 'reward', chapter: 'play', type: 'multi', max: 3,
    title: '奖励形式想要哪些？（最多 3 个）',
    sub: '干完活给点什么',
    options: [
      { v: 'coin',  e: '🪙', l: '虚拟金币', d: '攒着有数字快感' },
      { v: 'dress', e: '👗', l: '装扮精灵', d: '给它换配色' },
      { v: 'theme', e: '🎨', l: '解锁主题', d: '达成后开新绿系皮肤' },
      { v: 'honor', e: '🏆', l: '纯荣誉', d: '记一笔就够了' },
      { v: 'none',  e: '🫥', l: '都不要', d: '造物本身就是奖励' }
    ]
  },
  {
    id: 'punish', chapter: 'play', type: 'single',
    title: '要不要惩罚机制？',
    sub: '有人需要被 push，有人会被 push 垮',
    options: [
      { v: 'none',  e: '🕊️', l: '不要惩罚', d: '温柔到底' },
      { v: 'soft',  e: '👀', l: '温和提醒', d: '“好像今天还没动？”' },
      { v: 'minus', e: '📉', l: '扣积分', d: '真金白银地扣' },
      { v: 'sad',   e: '😢', l: '精灵失望脸', d: '愧疚感驱动' }
    ]
  },
  {
    id: 'surprise', chapter: 'play', type: 'multi', max: 3,
    title: '来点随机惊喜吗？（最多 3 个）',
    sub: '让每次打开有点新鲜感',
    options: [
      { v: 'box',   e: '🎁', l: '彩蛋宝箱', d: '偶尔掉个奖励' },
      { v: 'quote', e: '💌', l: '每日一句', d: '换不同的鸡汤 / 毒鸡汤' },
      { v: 'quest', e: '🎲', l: '随机挑战', d: '每天一个小任务' },
      { v: 'none',  e: '🫥', l: '不需要', d: '稳定就好' }
    ]
  },

  /* ===== 第五章 · 调参（6）===== */
  {
    id: 'hero', chapter: 'tune', type: 'single',
    title: '打开主界面，第一眼最想看到什么？',
    sub: '这是整块工作区的 C 位',
    options: [
      { v: 'tasks',   e: '✅', l: '今天的任务', d: '直接开干' },
      { v: 'stat',    e: '📊', l: '性能与数据', d: '先看战况' },
      { v: 'pet',     e: '🐾', l: '精灵状态', d: '先看它' },
      { v: 'assets',  e: '🧰', l: '资产库', d: '先挑素材' },
      { v: 'scene',   e: '🌄', l: '场景本体', d: '先看世界' },
      { v: 'goal',    e: '🎯', l: '目标进度', d: '确认方向' }
    ]
  },
  {
    id: 'taskview', chapter: 'tune', type: 'single',
    title: '任务的默认视图？',
    sub: '随时可以切换，这里只定默认',
    options: [
      { v: 'list',  e: '📋', l: '清单列表', d: '一行一条' },
      { v: 'board', e: '🗂️', l: '看板', d: '三列推着走' },
      { v: 'quad',  e: '🪟', l: '四象限', d: '重要 / 紧急' },
      { v: 'cal',   e: '📅', l: '日历', d: '按日期' }
    ]
  },
  {
    id: 'priority', chapter: 'tune', type: 'single',
    title: '任务优先级怎么分？',
    sub: '越简单越容易坚持',
    options: [
      { v: 'hl',   e: '🚦', l: '高 / 中 / 低', d: '三档就够' },
      { v: 'quad', e: '🪟', l: '重要紧急四象限', d: '艾森豪威尔法' },
      { v: 'none', e: '🫥', l: '不要优先级', d: '先做先赢' },
      { v: 'num',  e: '🔢', l: '数字排序', d: '手动拖拽顺序' }
    ]
  },
  {
    id: 'pomolen', chapter: 'tune', type: 'single',
    title: '专注计时一轮多久？',
    sub: '选一个你坐得住的长度',
    options: [
      { v: '25_5',  e: '🍅', l: '25 分钟 + 5 分钟', d: '经典款' },
      { v: '45_10', e: '🧠', l: '45 分钟 + 10 分钟', d: '深度工作' },
      { v: '15_3',  e: '⚡', l: '15 分钟 + 3 分钟', d: '碎片冲刺' },
      { v: '50_15', e: '🪵', l: '50 分钟 + 15 分钟', d: '长专注' }
    ]
  },
  {
    id: 'biome', chapter: 'tune', type: 'single',
    title: '起手想在哪个生态里造物？',
    sub: '新建世界时的默认生态，随时可换',
    options: [
      { v: 'grass',  e: '🌿', l: '草原', d: '生机 · 晨雾' },
      { v: 'snow',   e: '❄️', l: '雪原', d: '凛冽 · 静谧' },
      { v: 'desert', e: '🏜️', l: '沙漠', d: '苍茫 · 炽烈' },
      { v: 'cyber',  e: '🌃', l: '赛博', d: '霓虹 · 雨夜' }
    ]
  },
  {
    id: 'name', chapter: 'tune', type: 'text', required: true,
    title: '最后一步：给这块工作区起个名字',
    sub: '会作为新世界的默认名，随时可以改',
    placeholder: '比如：小怪兽作战室 / 今天也要赢 / 我的第二大脑',
    fallback: '我的造物世界'
  }
];

/* 选项值中文说明（结算 / 补填页展示） */
export const LABELS = {
  scene:    { work: '工作项目', study: '学习创作', life: '生活整理', indie: '独立游戏', team: '团队协作', all: '综合全能' },
  timeband: { morning: '清晨', noon: '上午', pm: '下午', night: '夜晚', deep: '深夜', any: '全天碎片' },
  pain:     { delay: '拖延启动', forget: '总是忘事', focus: '容易分心', nofb: '没有反馈', mess: '场景太杂', noreview: '从不复盘' },
  role:     { drill: '严厉教官', soft: '温柔伙伴', tool: '沉默工具', leader: '游戏领队', analyst: '数据参谋', scribe: '安静记录员' },
  device:   { big: '大屏', laptop: '笔记本', pad: '平板', phone: '手机', multi: '多端' },
  budget:   { '3': '3 分钟', '10': '10 分钟', '30': '30 分钟', '60': '1 小时+' },
  core:     { assets: '资产库', inspector: '检查器', console: '操作台', search: '全局搜索', hud: '性能 HUD', minimap: '小地图' },
  extra:    { kanban: '看板', stat: '数据统计', mood: '情绪记录', idea: '灵感箱', file: '资料库', journal: '复盘日记' },
  statdepth:{ lite: '只看帧率', week: '周报图表', heat: '热力图', trend: '趋势预测', full: '全维度看板' },
  remind:   { none: '不提醒', anim: '界面小动画', pet: '精灵对话', sound: '轻提示音', notify: '桌面通知' },
  storage:  { local: '本地存储', export: '可导出', cloud: '云同步' },
  people:   { solo: '单人', duo: '双人', team: '小队', org: '大团队' },
  palette:  { emerald: '翡翠绿', mint: '薄荷绿', forest: '森林绿', jade: '青玉绿', moss: '苔石绿', pine: '松针绿' },
  pet:      { dragon: '造物龙', fox: '灵狐', panda: '团子熊猫', frog: '泡泡蛙', owl: '守夜鸮', robot: '小铁皮' },
  texture:  { soft: '圆润软糖', flat: '简约线条', glass: '玻璃拟态', pixel: '像素复古', doodle: '手绘涂鸦' },
  light:    { day: '日间', dusk: '黄昏', night: '夜间', auto: '自动' },
  motion:   { calm: '几乎不动', normal: '轻微', playful: '活泼', max: '满屏特效' },
  density:  { one: '一屏一事', three: '舒适三栏', dense: '密集仪表盘' },
  xp:       { yes: '经验等级 ✓', no: '经验等级 ✗' },
  badge:    { yes: '成就徽章 ✓', no: '成就徽章 ✗' },
  combo:    { yes: '连击 ✓', no: '连击 ✗' },
  reward:   { coin: '金币', dress: '装扮', theme: '解锁主题', honor: '荣誉', none: '无奖励' },
  punish:   { none: '无惩罚', soft: '温和提醒', minus: '扣积分', sad: '失望脸' },
  surprise: { box: '彩蛋宝箱', quote: '每日一句', quest: '随机挑战', none: '无惊喜' },
  hero:     { tasks: '今日任务', stat: '性能数据', pet: '精灵状态', assets: '资产库', scene: '场景本体', goal: '目标进度' },
  taskview: { list: '清单', board: '看板', quad: '四象限', cal: '日历' },
  priority: { hl: '高/中/低', quad: '四象限', none: '无优先级', num: '数字排序' },
  pomolen:  { '25_5': '25+5', '45_10': '45+10', '15_3': '15+3', '50_15': '50+15' },
  biome:    { grass: '草原', snow: '雪原', desert: '沙漠', cyber: '赛博' }
};

/* 绿色家族：全部走 WorkBuddy 绿，accent 用于填充，a11y 用于浅底文字（AA ≥ 4.5） */
export const PALETTES = {
  emerald: { name: '翡翠绿', accent: '#10B981', accent2: '#34D399', soft: '#D1FAE5', a11y: '#047857', deep: '#065F46' },
  mint:    { name: '薄荷绿', accent: '#34D399', accent2: '#6EE7B7', soft: '#ECFDF5', a11y: '#047857', deep: '#065F46' },
  forest:  { name: '森林绿', accent: '#059669', accent2: '#10B981', soft: '#D1FAE5', a11y: '#065F46', deep: '#064E3B' },
  jade:    { name: '青玉绿', accent: '#06B6D4', accent2: '#22D3EE', soft: '#CFFAFE', a11y: '#0E7490', deep: '#155E75' },
  moss:    { name: '苔石绿', accent: '#84CC16', accent2: '#A3E635', soft: '#ECFCCB', a11y: '#4D7C0F', deep: '#3F6212' },
  pine:    { name: '松针绿', accent: '#065F46', accent2: '#10B981', soft: '#D1FAE5', a11y: '#064E3B', deep: '#022C22' }
};

/* 深浅底：day/dusk/night。文本对比全部按 WCAG AA 校过 */
export const BASES = {
  day:   { bg: '#F0F7F4', bg2: '#E3F2EA', panel: '#FFFFFF', card: '#FFFFFF', text: '#12362C', muted: '#4F6E62', line: 'rgba(16,185,129,.24)' },
  dusk:  { bg: '#F3F7EF', bg2: '#E8F0E2', panel: '#FFFDF8', card: '#FFFDF8', text: '#1B3628', muted: '#526B57', line: 'rgba(16,185,129,.26)' },
  night: { bg: '#0F1D18', bg2: '#14261F', panel: '#172B24', card: '#172B24', text: '#E9F7F1', muted: '#A7C2B7', line: 'rgba(52,211,153,.26)' }
};

/* 6 只造物精灵：emoji 直接落到 #pet，tone 对应台词库 */
export const PETS = {
  dragon: { name: '造物龙', emoji: '🐲', glow: '#10B981' },
  fox:    { name: '灵狐',   emoji: '🦊', glow: '#F59E0B' },
  panda:  { name: '团子熊猫', emoji: '🐼', glow: '#34D399' },
  frog:   { name: '泡泡蛙', emoji: '🐸', glow: '#84CC16' },
  owl:    { name: '守夜鸮', emoji: '🦉', glow: '#06B6D4' },
  robot:  { name: '小铁皮', emoji: '🤖', glow: '#22D3EE' }
};

/* 语气库：{n} 待办数 / {p} 完成率 / {m} 专注分钟 */
export const TONES = {
  drill:   ['别磨蹭，先放一个方块。', '今天的作品还没动，起来。', '做完一块地形，喘口气，继续。', '又卡住了？先做 5 分钟。'],
  soft:    ['慢慢来，一次一件事就好。', '已经很棒啦，休息一下也可以。', '今天也辛苦你了。', '要不要先喝口水？'],
  tool:    ['就绪。', '已记录。', '待办：{n} 项。', '完成 {p}% 。'],
  leader:  ['今日副本已开启，冲！', '主线任务刷新啦。', '连击别断，继续推！', 'Boss 就剩最后一点血了。'],
  analyst: ['今日完成率 {p}%。', '专注 {m} 分钟，低于周均值。', '面数增长偏快，注意合并。', '任务堆积 {n} 项，建议先清小的。'],
  scribe:  ['记下了。', '已归档。', '今日记录 {n} 条。', '随时写，我在。']
};

/* 安全默认：任何一题未作答都落到这里，保证「跳过全部」后 0 空缺 */
export const DEFAULTS = {
  scene: 'all',
  timeband: 'noon',
  pain: 'focus',
  role: 'leader',
  device: 'laptop',
  budget: '10',
  core: ['assets', 'inspector', 'console'],
  extra: ['stat', 'idea'],
  statdepth: 'week',
  remind: 'anim',
  storage: 'export',
  people: 'solo',
  palette: 'emerald',
  pet: 'dragon',
  texture: 'soft',
  light: 'day',
  motion: 'normal',
  density: 'three',
  xp: 'yes',
  badge: 'yes',
  combo: 'no',
  reward: ['coin'],
  punish: 'soft',
  surprise: ['quote'],
  hero: 'tasks',
  taskview: 'list',
  priority: 'hl',
  pomolen: '25_5',
  biome: 'grass',
  name: '我的造物世界'
};

/* 设备 → 画质档位（交给 main.js 的 setQuality） */
export const QUALITY_BY_DEVICE = {
  big: 'cinema', laptop: 'high', pad: 'medium', phone: 'low', multi: 'medium'
};

/* 时段 → 滑杆百分比（0-100） */
export const TIME_BY_BAND = {
  morning: 18, noon: 45, pm: 65, night: 82, deep: 96, any: 55
};

/* core 面板 → 现有面板键（left/right/bottom 三栏 + 附加块） */
export const PANEL_BY_CORE = {
  assets: 'left', inspector: 'right', console: 'bottom'
};

export const TOTAL = QUESTIONS.length;

export function questionById(id) {
  return QUESTIONS.find(q => q.id === id) || null;
}

export function chapterOf(q) {
  return CHAPTERS.find(c => c.id === q.chapter) || CHAPTERS[0];
}

export function labelOf(id, value) {
  const map = LABELS[id];
  if (!map) return value;
  return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value;
}

export function isEmpty(v) {
  if (v === undefined || v === null) return true;
  if (Array.isArray(v)) return v.length === 0;
  return String(v).trim() === '';
}
