-- Семья: 1+ детей (двойня, погодки) и 1+ родителей. Ребёнок может быть ещё не рождён и без имени.
CREATE TABLE IF NOT EXISTS families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  last_daily TEXT,                        -- дата последней утренней рассылки
  modules TEXT,                           -- JSON: что ведём (vaccines, feeding, growth, orders), по умолчанию всё
  routine TEXT,                           -- JSON: своя рутина — свои пункты и сроки встроенных (cleanRoutineCfg в data.js)
  created INTEGER
);
CREATE TABLE IF NOT EXISTS children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL REFERENCES families(id),
  name TEXT,                              -- NULL — имя ещё не выбрали
  birth TEXT,                             -- ГГГГ-ММ-ДД; NULL — ещё не родился
  due TEXT,                               -- предполагаемая дата родов, если ждём
  sex TEXT,                               -- girl | boy | NULL — для норм ВОЗ
  last_week INTEGER NOT NULL DEFAULT 0,   -- последняя отправленная карточка недели
  last_month INTEGER NOT NULL DEFAULT 0,  -- последнее поздравление с месяцем
  created INTEGER
);
CREATE INDEX IF NOT EXISTS children_family ON children(family_id);
CREATE TABLE IF NOT EXISTS members (
  user_id INTEGER PRIMARY KEY,            -- Telegram user id (он же chat id личного чата)
  family_id INTEGER NOT NULL REFERENCES families(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  role TEXT,                              -- mama | papa
  owner INTEGER NOT NULL DEFAULT 0,       -- 1 — основной родитель: только он приглашает
  created INTEGER
);
CREATE INDEX IF NOT EXISTS members_family ON members(family_id);
-- id: "c<child>:q:<week>:<i>" задание, "c<child>:d:<date>:<routine>" рутина, "o:<gear>" вещь (на семью; val 1 — есть, 2 — не нужно),
--     "n:<notice>:<season>:u<user>" — уведомление «Важное» прочитано (у каждого родителя своё). Сезонные отправки ботом — в settings: notice:<family>:<notice>:<season>
CREATE TABLE IF NOT EXISTS checks (
  family_id INTEGER NOT NULL,
  id TEXT NOT NULL,
  val INTEGER NOT NULL,
  by_user INTEGER,
  at INTEGER,
  PRIMARY KEY (family_id, id)
);
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  family_id INTEGER NOT NULL,
  created INTEGER
);
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT);
-- Прививки: по записи на ребёнка. code — из календаря (VACCINES в data.js), NULL — своя запись (например, Манту).
-- Создаются автоматически, когда у ребёнка появляется дата рождения. Безопасно выполнять повторно.
CREATE TABLE IF NOT EXISTS vaccines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL,
  child_id INTEGER NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  planned TEXT,                           -- ГГГГ-ММ-ДД по календарю или своя дата
  status TEXT NOT NULL DEFAULT 'planned', -- planned | booked | done | skip (только для рекомендованных и своих)
  booked_at TEXT,                         -- ГГГГ-ММ-ДД или ГГГГ-ММ-ДДTЧЧ:ММ — на когда записались
  done_date TEXT,                         -- когда сделали; NULL при done — дата не указана
  note TEXT,                              -- клиника, серия, реакция
  by_user INTEGER,
  at INTEGER,
  UNIQUE (child_id, code)
);
CREATE INDEX IF NOT EXISTS vaccines_family ON vaccines(family_id);

-- Замеры веса и роста (для графика по нормам ВОЗ)
CREATE TABLE IF NOT EXISTS measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL,
  child_id INTEGER NOT NULL,
  date TEXT NOT NULL,                     -- ГГГГ-ММ-ДД
  weight_g INTEGER NOT NULL,
  length_cm REAL,
  by_user INTEGER,
  at INTEGER
);
CREATE INDEX IF NOT EXISTS measurements_family ON measurements(family_id, child_id, date);

-- Кормления. side: L | R | B (бутылочка). end_at NULL — идёт сейчас. chat_id/msg_id — сообщение-таймер в боте.
-- Пауза: paused_at — с какого момента стоит на паузе (NULL — идёт), pause_ms — сколько уже простояло. Длительность = end_at − start_at − pause_ms.
CREATE TABLE IF NOT EXISTS feedings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL,
  child_id INTEGER NOT NULL,
  side TEXT NOT NULL,
  start_at INTEGER NOT NULL,              -- мс эпохи
  end_at INTEGER,
  by_user INTEGER,
  chat_id INTEGER,
  msg_id INTEGER,
  created INTEGER,
  paused_at INTEGER,
  pause_ms INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS feedings_family ON feedings(family_id, start_at);
CREATE INDEX IF NOT EXISTS feedings_active ON feedings(end_at);

-- Сон. end_at NULL — спит сейчас. chat_id/msg_id — сообщение-таймер в боте.
CREATE TABLE IF NOT EXISTS sleeps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id INTEGER NOT NULL,
  child_id INTEGER NOT NULL,
  start_at INTEGER NOT NULL,              -- мс эпохи
  end_at INTEGER,
  by_user INTEGER,
  created INTEGER,
  chat_id INTEGER,
  msg_id INTEGER
);
CREATE INDEX IF NOT EXISTS sleeps_family ON sleeps(family_id, start_at);

-- Основной родитель подписался на канал (проверено ботом)
CREATE TABLE IF NOT EXISTS gate (user_id INTEGER PRIMARY KEY, ok_at INTEGER);

-- Все, кто писал боту или открывал приложение (для админки): имя и @username из Telegram, когда впервые и последний раз
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  tg_lang TEXT,                           -- language_code из Telegram
  first_seen INTEGER,                     -- мс эпохи; NULL — был до появления таблицы и времени не знаем
  last_seen INTEGER,
  src TEXT                                -- bot | app | web — откуда последний раз
);

-- язык пользователя (uk/ru); нет строки — украинский
CREATE TABLE IF NOT EXISTS user_lang (user_id INTEGER PRIMARY KEY, lang TEXT NOT NULL);

-- Обратная связь из мини-аппа: like — отзыв (1 на человека), idea — предложение, issue — неполадка (до 10 каждого).
-- family_id NULL — пишет человек без семьи. Отзывы никуда не публикуются: их читают только админы (ADMIN_IDS).
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  family_id INTEGER,
  kind TEXT NOT NULL,                     -- like | idea | issue
  text TEXT NOT NULL,
  rating INTEGER,                         -- 1–5, только у like, по желанию
  meta TEXT,                              -- JSON: версия аппа, вкладка, платформа Telegram, язык, ширина экрана
  status TEXT NOT NULL DEFAULT 'new',     -- new | seen | done
  created INTEGER NOT NULL,
  updated INTEGER,
  liked INTEGER NOT NULL DEFAULT 0,       -- разработчику понравилось (кнопка в сообщении админу)
  reply TEXT,                             -- ответ разработчика; человек видит его в приложении и получает в бот
  reply_at INTEGER
);
CREATE INDEX IF NOT EXISTS feedback_user ON feedback(user_id, created);
CREATE INDEX IF NOT EXISTS feedback_created ON feedback(created);
-- Прежние версии: что человек переписал или удалил (у удалённого строки в feedback уже нет)
CREATE TABLE IF NOT EXISTS feedback_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  kind TEXT,
  text TEXT NOT NULL,
  action TEXT NOT NULL,                   -- edited | deleted
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_history_user ON feedback_history(user_id, at);
