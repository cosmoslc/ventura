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

  // S1: Ishchilar
  workers_title: "Работники",
  workers_subtitle: "Работники цеха, типы зарплат и ставки",
  workers_add: "Новый работник",
  workers_edit: "Редактировать работника",
  workers_active: "Активные работники",
  workers_archived: "В архиве",
  workers_archive_confirm: "Вы действительно хотите архивировать этого работника?",
  workers_restore: "Восстановить из архива",
  workers_archive_action: "В архив",
  workers_name: "Имя работника",
  workers_phone: "Номер телефона",
  workers_salary_type: "Тип зарплаты",
  salary_piecework: "Сдельная (за шт/куб)",
  salary_daily: "Дневная ставка",
  salary_weekly: "Еженедельная ставка",
  salary_monthly: "Ежемесячный оклад",
  workers_wage_amount: "Сумма ставки",
  workers_empty: "Работники пока не добавлены",

  // S1: Materiallar
  materials_title: "Каталог материалов",
  materials_subtitle: "Размеры и типы расчета сырья и готовой продукции",
  materials_add: "Новый материал",
  materials_edit: "Редактировать материал",
  materials_name: "Название материала",
  materials_unit: "Единица",
  materials_pricing_mode: "Способ расчета",
  pricing_piece: "По штукам",
  pricing_row: "По рядам",
  materials_dimensions: "Размеры (Толщина × Ширина × Длина)",
  materials_volume: "Объем 1 штуки",
  materials_sizes: "Варианты размеров",
  materials_add_size: "Добавить размер",
  materials_empty: "Материалы пока отсутствуют",

  // S1: Yuk mashinalari
  trucks_title: "Грузовые машины",
  trucks_subtitle: "Транспорт и стоимость рейсов",
  trucks_add: "Новая машина",
  trucks_edit: "Редактировать машину",
  trucks_name: "Название или номер машины",
  trucks_amount: "Стоимость рейса",
  trucks_empty: "Машины пока не добавлены",

  // S1: Sozlamalar va Ish turlari
  settings_title: "Настройки цеха",
  settings_subtitle: "Правила расчета, единицы и виды работ",
  settings_profit_mode: "Способ расчета прибыли",
  profit_estimated: "Ожидаемая (примерная прибыль)",
  profit_actual: "Фактическая (по отгрузкам)",
  settings_qty_display: "Отображение количества",
  qty_piece: "Штуки",
  qty_cube: "Кубические метры (м³)",
  qty_both: "Оба варианта",
  settings_cube_input_mode: "Способ ввода куба",
  cube_direct: "Прямой (ввод м³)",
  cube_calculated: "Из размеров (расчет из штук)",
  settings_dimension_unit: "Единица ввода размеров",
  unit_mm: "Миллиметры (мм)",
  unit_sm: "Сантиметры (см)",
  unit_m: "Метры (м)",
  settings_work_types: "Виды работ",
  settings_add_work_type: "Новый вид работы",
  settings_work_type_name: "Название вида работы",
  settings_work_type_kind: "Тип",
  work_kind_regular: "Обычная работа",
  work_kind_sorting: "Сортировка",
  settings_save_success: "Настройки успешно сохранены",
};
