import type { TranslationKey } from "./uz";

export const ru: Record<TranslationKey, string> = {
  // Brand & Shell
  app_name: "Управление Пилорамой",
  app_tagline: "Система учета лесопильного цеха",

  // Navigatsiya
  nav_home: "Главная",
  nav_teraks: "Партии леса",
  nav_workers: "Рабочие",
  nav_work: "Ежедневная работа",
  nav_stock: "Склад",
  nav_materials: "Материалы",
  nav_dispatch: "Отгрузка",
  nav_trucks: "Грузовики",
  nav_expenses: "Общие расходы",
  nav_orders: "Заказы",
  nav_reports: "Отчеты",
  nav_settings: "Настройки",
  nav_staff: "Сотрудники",
  nav_activity: "Журнал действий",

  // Bo'lim guruhlari
  nav_group_main: "Основное",
  nav_group_operations: "Склад и сбыт",
  nav_group_finance: "Финансы",
  nav_group_analytics: "Аналитика",
  nav_group_system: "Система",

  // Tezkor amallar
  quick_actions: "Быстрые действия",
  quick_add_work: "Добавить работу",
  quick_add_dispatch: "Отгрузить товар",
  quick_add_cost: "Добавить расход",
  quick_add_worker: "Добавить рабочего",
  quick_add_terak: "Добавить партию",

  // Rollar
  role_owner: "Владелец",
  role_accountant: "Бухгалтер",
  role_viewer: "Наблюдатель",

  // Kirish (Auth)
  login_title: "Вход в систему",
  login_subtitle: "Введите номер телефона и пароль для доступа к панели пилорамы",
  login_phone_label: "Номер телефона",
  login_password_label: "Пароль",
  login_button: "Войти",
  login_submitting: "Проверка...",
  login_error_invalid: "Неверный номер телефона или пароль",
  login_error_locked: "Учетная запись временно заблокирована",

  // Umumiy amallar va so'zlar
  action_save: "Сохранить",
  action_cancel: "Отмена",
  action_delete: "Удалить",
  action_edit: "Редактировать",
  action_add: "Добавить",
  action_search: "Поиск",
  action_filter: "Фильтр",
  action_close: "Закрыть",
  action_logout: "Выйти",
  action_refresh: "Обновить",

  // Holatlar
  status_loading: "Загрузка...",
  status_empty: "Данные не найдены",
  status_success: "Успешно сохранено",
  status_error: "Произошла ошибка",

  // Bo'lim yopiq
  feature_disabled_title: "Этот раздел отключен",
  feature_disabled_desc: "Для использования этой функции активируйте её в панели управления Ventura.",
  feature_disabled_back: "Вернуться на главную",

  // Til va mavzu
  language_uz: "O'zbekcha",
  language_ru: "Русский",
  theme_light: "Светлая",
  theme_dark: "Темная",
  theme_system: "Системная",

  // Bosh sahifa
  home_welcome: "Добро пожаловать в Управление Пилорамой",
  home_welcome_desc: "Управляйте закупками леса, трудом рабочих, остатками на складе и прибылью в одном месте.",
  home_select_terak: "Выберите партию",
  home_all_teraks: "Все партии",
};
