/**
 * =====================================================
 * МЕНЕДЖЕР МОДУЛІВ (ModuleManager.js)
 * =====================================================
 * Відповідає за:
 * - Завантаження модулів з папки /modules
 * - Активацію/деактивацію модулів
 * - Реєстрацію хуків та маршрутів
 * - Гаряче перезавантаження модулів без перезапуску сервера
 * =====================================================
 */

const fs = require('fs');
const path = require('path');
const BaseModule = require('../../core/modules/modules.js');

class ModuleManager {
    constructor() {
        this.modulesPath = path.join(__dirname, '..', 'modules');
        this.modules = new Map(); // Зберігаємо екземпляри модулів
        this.hooksRegistry = {};  // Глобальний реєстр хуків
        this.app = null;          // Express додаток
    }

    /**
     * Ініціалізація менеджера модулів
     * @param {Object} app - Express додаток
     */
    init(app) {
        this.app = app;
        console.log('[ModuleManager] Initialized');
    }

    /**
     * Завантаження всіх модулів з папки /modules
     */
    loadAllModules() {
        if (!fs.existsSync(this.modulesPath)) {
            console.log('[ModuleManager] Modules directory does not exist. Creating...');
            fs.mkdirSync(this.modulesPath, { recursive: true });
            return;
        }

        const moduleDirs = fs.readdirSync(this.modulesPath);

        moduleDirs.forEach(dirName => {
            const moduleDir = path.join(this.modulesPath, dirName);

            // Пропускаємо якщо це не директорія
            if (!fs.statSync(moduleDir).isDirectory()) {
                return;
            }

            // Перевіряємо наявність module.json
            const configPath = path.join(moduleDir, 'module.json');
            if (!fs.existsSync(configPath)) {
                console.warn(`[ModuleManager] Skipping ${dirName}: no module.json found`);
                return;
            }

            try {
                this.loadModule(dirName, moduleDir, configPath);
            } catch (error) {
                console.error(`[ModuleManager] Error loading module ${dirName}:`, error.message);
            }
        });

        console.log(`[ModuleManager] Loaded ${this.modules.size} modules`);
    }

    /**
     * Завантаження конкретного модуля
     * @param {string} dirName - Назва директорії модуля
     * @param {string} moduleDir - Повний шлях до директорії модуля
     * @param {string} configPath - Шлях до module.json
     */
    loadModule(dirName, moduleDir, configPath) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        // Додаємо шлях до конфігурації
        config.localPath = moduleDir;

        // Очищаємо кеш модуля для гарячого перезавантаження
        const mainFilePath = path.join(moduleDir, 'index.js');
        if (fs.existsSync(mainFilePath)) {
            delete require.cache[require.resolve(mainFilePath)];
        }

        // Імпортуємо клас модуля
        const ModuleClass = require(mainFilePath);

        // Створюємо екземпляр модуля
        const moduleInstance = new ModuleClass(config);

        // Зберігаємо модуль
        this.modules.set(config.name, {
            instance: moduleInstance,
            config: config,
            path: moduleDir,
            isEnabled: false
        });

        console.log(`[ModuleManager] Loaded module: ${config.name} v${config.version}`);
    }

    /**
     * Активація модуля
     * @param {string} moduleName - Назва модуля
     */
    async enableModule(moduleName) {
        const moduleData = this.modules.get(moduleName);

        if (!moduleData) {
            throw new Error(`Module ${moduleName} not found`);
        }

        if (moduleData.isEnabled) {
            console.log(`[ModuleManager] Module ${moduleName} is already enabled`);
            return;
        }

        try {
            // Викликаємо метод enable модуля
            await moduleData.instance.enable();

            // Реєструємо хуки
            this.registerModuleHooks(moduleName);

            // Реєструємо маршрути
            this.registerModuleRoutes(moduleName);

            moduleData.isEnabled = true;
            console.log(`[ModuleManager] Module ${moduleName} enabled successfully`);
        } catch (error) {
            console.error(`[ModuleManager] Error enabling module ${moduleName}:`, error.message);
            throw error;
        }
    }

    /**
     * Деактивація модуля
     * @param {string} moduleName - Назва модуля
     */
    async disableModule(moduleName) {
        const moduleData = this.modules.get(moduleName);

        if (!moduleData) {
            throw new Error(`Module ${moduleName} not found`);
        }

        if (!moduleData.isEnabled) {
            console.log(`[ModuleManager] Module ${moduleName} is already disabled`);
            return;
        }

        try {
            // Викликаємо метод disable модуля
            await moduleData.instance.disable();

            // Видаляємо хуки
            this.unregisterModuleHooks(moduleName);

            // Примітка: маршрути не можна видалити з Express динамічно
            // Тому вони залишаються зареєстрованими, але обробник може перевіряти статус

            moduleData.isEnabled = false;
            console.log(`[ModuleManager] Module ${moduleName} disabled successfully`);
        } catch (error) {
            console.error(`[ModuleManager] Error disabling module ${moduleName}:`, error.message);
            throw error;
        }
    }

    /**
     * Реєстрація хуків модуля в глобальному реєстрі
     * @param {string} moduleName - Назва модуля
     */
    registerModuleHooks(moduleName) {
        const moduleData = this.modules.get(moduleName);
        const hooks = moduleData.instance.getHooks();

        Object.keys(hooks).forEach(hookName => {
            if (!this.hooksRegistry[hookName]) {
                this.hooksRegistry[hookName] = [];
            }

            hooks[hookName].forEach(callback => {
                this.hooksRegistry[hookName].push({
                    moduleName,
                    callback
                });
            });
        });

        console.log(`[ModuleManager] Registered hooks for module ${moduleName}`);
    }

    /**
     * Видалення хуків модуля з глобального реєстру
     * @param {string} moduleName - Назва модуля
     */
    unregisterModuleHooks(moduleName) {
        Object.keys(this.hooksRegistry).forEach(hookName => {
            this.hooksRegistry[hookName] = this.hooksRegistry[hookName].filter(
                hook => hook.moduleName !== moduleName
            );

            // Видаляємо порожні масиви
            if (this.hooksRegistry[hookName].length === 0) {
                delete this.hooksRegistry[hookName];
            }
        });

        console.log(`[ModuleManager] Unregistered hooks for module ${moduleName}`);
    }

    /**
     * Реєстрація маршрутів модуля в Express
     * @param {string} moduleName - Назва модуля
     */
    registerModuleRoutes(moduleName) {
        const moduleData = this.modules.get(moduleName);
        const routes = moduleData.instance.getRoutes();
        const moduleInstance = moduleData.instance;

        routes.forEach(route => {
            const fullPath = `/api/module/${moduleName}${route.path}`;

            // Обгортаємо обробник у try-catch для безпеки
            const safeHandler = async (req, res, next) => {
                try {
                    // Перевіряємо чи активний модуль
                    if (!moduleData.isEnabled) {
                        return res.status(403).json({
                            error: `Module ${moduleName} is disabled`
                        });
                    }

                    await route.handler.call(moduleInstance, req, res, next);
                } catch (error) {
                    console.error(`[Module ${moduleName}] Route error:`, error.message);
                    next(error);
                }
            };

            // Реєструємо маршрут в Express
            const method = route.method.toLowerCase();
            if (this.app[method]) {
                this.app[method](fullPath, safeHandler);
                console.log(`[ModuleManager] Registered route: ${method.toUpperCase()} ${fullPath}`);
            }
        });
    }

    /**
     * Отримання списку всіх хуків для виклику в шаблоні
     * @param {string} hookName - Назва хука
     * @param {Object} params - Параметри для передачі в хук
     * @returns {Promise<Array>} - Масив результатів від всіх модулів
     */
    async execHook(hookName, params = {}) {
        if (!this.hooksRegistry[hookName]) {
            return [];
        }

        const results = [];

        for (const hook of this.hooksRegistry[hookName]) {
            try {
                // Перевіряємо чи активний модуль
                const moduleData = this.modules.get(hook.moduleName);
                if (!moduleData || !moduleData.isEnabled) {
                    continue;
                }

                const result = await hook.callback.call(moduleData.instance, params);
                if (result !== null && result !== undefined) {
                    results.push(result);
                }
            } catch (error) {
                console.error(`[ModuleManager] Error executing hook ${hookName} in ${hook.moduleName}:`, error.message);
            }
        }

        return results;
    }

    /**
     * Middleware для використання хуків в EJS шаблонах
     * Додає функцію hook() в res.locals
     */
    hooksMiddleware() {
        return (req, res, next) => {
            res.locals.hook = async (hookName, params = {}) => {
                const results = await this.execHook(hookName, params);
                return results.join('\n');
            };
            next();
        };
    }

    /**
     * Перезавантаження модуля (гаряче оновлення)
     * @param {string} moduleName - Назва модуля
     */
    async reloadModule(moduleName) {
        const moduleData = this.modules.get(moduleName);

        if (!moduleData) {
            throw new Error(`Module ${moduleName} not found`);
        }

        const wasEnabled = moduleData.isEnabled;

        // Вимикаємо модуль
        if (wasEnabled) {
            await this.disableModule(moduleName);
        }

        // Перезавантажуємо файл модуля
        const mainFilePath = path.join(moduleData.path, 'index.js');
        delete require.cache[require.resolve(mainFilePath)];

        // Створюємо новий екземпляр
        const ModuleClass = require(mainFilePath);
        moduleData.instance = new ModuleClass(moduleData.config);

        // Вмикаємо назад якщо був активний
        if (wasEnabled) {
            await this.enableModule(moduleName);
        }

        console.log(`[ModuleManager] Reloaded module ${moduleName}`);
    }

    /**
     * Отримання інформації про всі модулі
     * @returns {Array}
     */
    getAllModules() {
        const result = [];

        this.modules.forEach((moduleData, name) => {
            result.push({
                name: name,
                version: moduleData.config.version,
                description: moduleData.config.description,
                author: moduleData.config.author,
                isEnabled: moduleData.isEnabled,
                hasConfig: moduleData.config.hasConfig || false
            });
        });

        return result;
    }

    /**
     * Отримання інформації про конкретний модуль
     * @param {string} moduleName - Назва модуля
     * @returns {Object|null}
     */
    getModule(moduleName) {
        const moduleData = this.modules.get(moduleName);

        if (!moduleData) {
            return null;
        }

        return {
            name: moduleName,
            version: moduleData.config.version,
            description: moduleData.config.description,
            author: moduleData.config.author,
            isEnabled: moduleData.isEnabled,
            config: moduleData.config
        };
    }
}

// Створюємо singleton екземпляр
const moduleManager = new ModuleManager();

module.exports = moduleManager;
