import { createSlice } from '@reduxjs/toolkit';
import { queueAction } from './syncSlice';

export const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    appName: '',
    units: ['lbs', 'kg', 'bushels', 'crates', 'tons'],
    kmlUrls: [],
    logo: null,
    polygonColor: '#2e7d32',
    mapCenter: [51.505, -0.09],
    mapZoom: 13,
    gpsDistanceThreshold: 10,
    jobTitles: ['Foreman', 'Harvester', 'Tractor Operator', 'Security', 'General Manager'],
    expenseCategories: ['Equipment Maintenance', 'Fertilizer', 'Fuel', 'Labor', 'Seed'],
    incomeCategories: ['Crop Sale', 'Livestock Sale', 'Subsidy'],
    animalTypes: ['Cattle', 'Goat', 'Poultry', 'Sheep', 'Swine'],
    visibleMapLayers: ['fields', 'nurseries', 'pois', 'equipment', 'soilTests'],
    snapGap: 5,
    geeClientEmail: '',
    geePrivateKey: '',
    geeProjectId: '',
    geeScale: 3,
    owmApiKey: '',
    themeAppBgColor: '#eeeef1',
    themeCardBgColor: '#ffffff',
    themeCardBorderColor: '#e0e0e0',
    themeCardBorderThickness: '0.50px',
    themeAppBorderColor: '#363535',
    themeAppBorderThickness: '0.50px',
    themeFontName: 'System Default',
    themeFontSizeBase: '14px',
    themeFontSizeCardTitle: '1.25rem',
    themeFontSizeTabs: '0.9rem',
    themeColorPrimary: '#2e7d32',
    themeColorCardTitle: '#2e7d32',
    themeColorTabsActiveBg: '#2e7d32',
    themeColorTabsActiveText: '#ffffff',
    themeColorTabsInactiveBg: '#ffffff',
    themeColorTabsInactiveText: '#6a6a6a',
    themeFontAppName: 'System Default',
    themeFontSizeAppName: '1.5rem',
    themeFontAppNameBold: true,
    themeFontAppNameCapitalize: false,
    themeFontSizeBaseBold: false,
    themeFontSizeBaseCapitalize: false,
    themeFontSizeCardTitleBold: true,
    themeFontSizeCardTitleCapitalize: false,
    themeFontSizeTabsBold: false,
    themeFontSizeTabsCapitalize: false,
    themeFontImager: 'Roboto',
    themeFontSizeImager: '0.72rem',
    themeFontImagerBold: false,
    themeFontImagerCapitalize: true,
    mtnClientId: '',
    mtnClientSecret: '',
    mtnEnvironment: 'sandbox',
    simulateHighWinds: false,
    googleMapsApiKey: '',
    geminiApiKey: '',
    claudeApiKey: '',
    aiProvider: 'gemini',
    neo4jUri: '',
    neo4jUser: '',
    neo4jPassword: '',
    neo4jDatabase: '',
    workdayHours: 7.0,
    workdays: [1, 2, 3, 4, 5, 6, 0],
  },
  reducers: {
    addUnit: (state, action) => {
      if (!state.units.includes(action.payload)) {
        state.units.push(action.payload);
      }
    },
    removeUnit: (state, action) => {
      state.units = state.units.filter(u => u !== action.payload);
    },
    addJobTitle: (state, action) => {
      if (!state.jobTitles) state.jobTitles = [];
      if (!state.jobTitles.includes(action.payload)) {
        state.jobTitles.push(action.payload);
      }
    },
    removeJobTitle: (state, action) => {
      if (!state.jobTitles) state.jobTitles = [];
      state.jobTitles = state.jobTitles.filter(t => t !== action.payload);
    },
    addExpenseCategory: (state, action) => {
      if (!state.expenseCategories) state.expenseCategories = [];
      if (!state.expenseCategories.includes(action.payload)) {
        state.expenseCategories.push(action.payload);
      }
    },
    removeExpenseCategory: (state, action) => {
      if (!state.expenseCategories) state.expenseCategories = [];
      state.expenseCategories = state.expenseCategories.filter(c => c !== action.payload);
    },
    addIncomeCategory: (state, action) => {
      if (!state.incomeCategories) state.incomeCategories = [];
      if (!state.incomeCategories.includes(action.payload)) {
        state.incomeCategories.push(action.payload);
      }
    },
    removeIncomeCategory: (state, action) => {
      if (!state.incomeCategories) state.incomeCategories = [];
      state.incomeCategories = state.incomeCategories.filter(c => c !== action.payload);
    },
    addKmlUrl: (state, action) => {
      if (!state.kmlUrls) state.kmlUrls = [];
      if (!state.kmlUrls.includes(action.payload)) {
        state.kmlUrls.push(action.payload);
      }
    },
    removeKmlUrl: (state, action) => {
      if (!state.kmlUrls) state.kmlUrls = [];
      state.kmlUrls = state.kmlUrls.filter(u => u !== action.payload);
    },
    setLogo: (state, action) => {
      state.logo = action.payload;
    },
    setPolygonColor: (state, action) => {
      state.polygonColor = action.payload;
    },
    setMapCenter: (state, action) => {
      state.mapCenter = action.payload;
    },
    setMapZoom: (state, action) => {
      state.mapZoom = action.payload;
    },
    setGpsDistanceThreshold: (state, action) => {
      state.gpsDistanceThreshold = action.payload;
    },
    setAppName: (state, action) => {
      state.appName = action.payload;
    },
    addAnimalType: (state, action) => {
      if (!state.animalTypes) state.animalTypes = [];
      if (!state.animalTypes.includes(action.payload)) {
        state.animalTypes.push(action.payload);
      }
    },
    removeAnimalType: (state, action) => {
      if (!state.animalTypes) state.animalTypes = [];
      state.animalTypes = state.animalTypes.filter(t => t !== action.payload);
    },
    setAllSettings: (state, action) => {
      const payload = { ...action.payload };
      
      // Backward compatibility: If workdays is undefined but nonWorkdays is present
      if (payload.workdays === undefined) {
        if (payload.nonWorkdays !== undefined && payload.nonWorkdays !== null) {
          let nwd = payload.nonWorkdays;
          if (typeof nwd === 'string') {
            try { nwd = JSON.parse(nwd); } catch (e) {}
          }
          if (Array.isArray(nwd)) {
            const nwdNums = nwd.map(Number);
            payload.workdays = [1, 2, 3, 4, 5, 6, 0].filter(d => !nwdNums.includes(d));
          }
        }
      }

      if (payload.workdays !== undefined) {
        if (payload.workdays === null || payload.workdays === '') {
          payload.workdays = [];
        } else {
          let parsed = payload.workdays;
          if (typeof parsed === 'string') {
            try {
              parsed = JSON.parse(parsed);
            } catch (e) {
              if (parsed.trim() === '') parsed = [];
              else parsed = parsed.split(',').map(Number).filter(n => !isNaN(n));
            }
          }
          payload.workdays = Array.isArray(parsed) ? parsed.map(Number) : [];
        }
      } else {
        payload.workdays = state.workdays !== undefined ? state.workdays : [1, 2, 3, 4, 5, 6, 0];
      }
      return { ...state, ...payload };
    },
    setVisibleMapLayers: (state, action) => {
      state.visibleMapLayers = action.payload;
    },
    setSnapGap: (state, action) => {
      state.snapGap = action.payload;
    },
    setGeeClientEmail: (state, action) => {
      state.geeClientEmail = action.payload;
    },
    setGeePrivateKey: (state, action) => {
      state.geePrivateKey = action.payload;
    },
    setGeeProjectId: (state, action) => {
      state.geeProjectId = action.payload;
    },
    setGeeScale: (state, action) => {
      state.geeScale = action.payload;
    },
    setOwmApiKey: (state, action) => {
      state.owmApiKey = action.payload;
    },
    setThemeAppBgColor: (state, action) => {
      state.themeAppBgColor = action.payload;
    },
    setThemeCardBgColor: (state, action) => {
      state.themeCardBgColor = action.payload;
    },
    setThemeCardBorderColor: (state, action) => {
      state.themeCardBorderColor = action.payload;
    },
    setThemeCardBorderThickness: (state, action) => {
      state.themeCardBorderThickness = action.payload;
    },
    setThemeAppBorderColor: (state, action) => {
      state.themeAppBorderColor = action.payload;
    },
    setThemeAppBorderThickness: (state, action) => {
      state.themeAppBorderThickness = action.payload;
    },
    setThemeFontName: (state, action) => {
      state.themeFontName = action.payload;
    },
    setThemeFontSizeBase: (state, action) => {
      state.themeFontSizeBase = action.payload;
    },
    setThemeFontSizeCardTitle: (state, action) => {
      state.themeFontSizeCardTitle = action.payload;
    },
    setThemeFontSizeTabs: (state, action) => {
      state.themeFontSizeTabs = action.payload;
    },
    setThemeColorPrimary: (state, action) => {
      state.themeColorPrimary = action.payload;
    },
    setThemeColorCardTitle: (state, action) => {
      state.themeColorCardTitle = action.payload;
    },
    setThemeColorTabsActiveBg: (state, action) => {
      state.themeColorTabsActiveBg = action.payload;
    },
    setThemeColorTabsActiveText: (state, action) => {
      state.themeColorTabsActiveText = action.payload;
    },
    setThemeColorTabsInactiveBg: (state, action) => {
      state.themeColorTabsInactiveBg = action.payload;
    },
    setThemeColorTabsInactiveText: (state, action) => {
      state.themeColorTabsInactiveText = action.payload;
    },
    setThemeFontAppName: (state, action) => {
      state.themeFontAppName = action.payload;
    },
    setThemeFontSizeAppName: (state, action) => {
      state.themeFontSizeAppName = action.payload;
    },
    setThemeFontAppNameBold: (state, action) => {
      state.themeFontAppNameBold = action.payload;
    },
    setThemeFontAppNameCapitalize: (state, action) => {
      state.themeFontAppNameCapitalize = action.payload;
    },
    setThemeFontSizeBaseBold: (state, action) => {
      state.themeFontSizeBaseBold = action.payload;
    },
    setThemeFontSizeBaseCapitalize: (state, action) => {
      state.themeFontSizeBaseCapitalize = action.payload;
    },
    setThemeFontSizeCardTitleBold: (state, action) => {
      state.themeFontSizeCardTitleBold = action.payload;
    },
    setThemeFontSizeCardTitleCapitalize: (state, action) => {
      state.themeFontSizeCardTitleCapitalize = action.payload;
    },
    setThemeFontSizeTabsBold: (state, action) => {
      state.themeFontSizeTabsBold = action.payload;
    },
    setThemeFontSizeTabsCapitalize: (state, action) => {
      state.themeFontSizeTabsCapitalize = action.payload;
    },
    setThemeFontImager: (state, action) => {
      state.themeFontImager = action.payload;
    },
    setThemeFontSizeImager: (state, action) => {
      state.themeFontSizeImager = action.payload;
    },
    setThemeFontImagerBold: (state, action) => {
      state.themeFontImagerBold = action.payload;
    },
    setThemeFontImagerCapitalize: (state, action) => {
      state.themeFontImagerCapitalize = action.payload;
    },
    setMtnClientId: (state, action) => {
      state.mtnClientId = action.payload;
    },
    setMtnClientSecret: (state, action) => {
      state.mtnClientSecret = action.payload;
    },
    setMtnEnvironment: (state, action) => {
      state.mtnEnvironment = action.payload;
    },
    setSimulateHighWinds: (state, action) => {
      state.simulateHighWinds = action.payload;
    },
    setGoogleMapsApiKey: (state, action) => {
      state.googleMapsApiKey = action.payload;
    },
    setGeminiApiKey: (state, action) => {
      state.geminiApiKey = action.payload;
    },
    setClaudeApiKey: (state, action) => {
      state.claudeApiKey = action.payload;
    },
    setAiProvider: (state, action) => {
      state.aiProvider = action.payload;
    },
    setNeo4jUri: (state, action) => {
      state.neo4jUri = action.payload;
    },
    setNeo4jUser: (state, action) => {
      state.neo4jUser = action.payload;
    },
    setNeo4jPassword: (state, action) => {
      state.neo4jPassword = action.payload;
    },
    setNeo4jDatabase: (state, action) => {
      state.neo4jDatabase = action.payload;
    },
    setWorkdayHours: (state, action) => {
      state.workdayHours = action.payload;
    },
    setWorkdays: (state, action) => {
      const val = action.payload;
      if (val === null || val === undefined || val === '') {
        state.workdays = [];
      } else {
        state.workdays = Array.isArray(val) ? val.map(Number) : [Number(val)];
      }
    }
  }
});

export const { addUnit, removeUnit, addJobTitle, removeJobTitle, addExpenseCategory, removeExpenseCategory, addIncomeCategory, removeIncomeCategory, addKmlUrl, removeKmlUrl, setLogo, setPolygonColor, setMapCenter, setMapZoom, setGpsDistanceThreshold, setAppName, addAnimalType, removeAnimalType, setAllSettings, setVisibleMapLayers, setSnapGap, setGeeClientEmail, setGeePrivateKey, setGeeProjectId, setGeeScale, setOwmApiKey, setThemeAppBgColor, setThemeCardBgColor, setThemeCardBorderColor, setThemeCardBorderThickness, setThemeAppBorderColor, setThemeAppBorderThickness, setThemeFontName, setThemeFontSizeBase, setThemeFontSizeCardTitle, setThemeFontSizeTabs, setThemeColorPrimary, setThemeColorCardTitle, setThemeColorTabsActiveBg, setThemeColorTabsActiveText, setThemeColorTabsInactiveBg, setThemeColorTabsInactiveText, setThemeFontAppName, setThemeFontSizeAppName, setThemeFontAppNameBold, setThemeFontAppNameCapitalize, setThemeFontSizeBaseBold, setThemeFontSizeBaseCapitalize, setThemeFontSizeCardTitleBold, setThemeFontSizeCardTitleCapitalize, setThemeFontSizeTabsBold, setThemeFontSizeTabsCapitalize, setThemeFontImager, setThemeFontSizeImager, setThemeFontImagerBold, setThemeFontImagerCapitalize, setMtnClientId, setMtnClientSecret, setMtnEnvironment, setSimulateHighWinds, setGoogleMapsApiKey, setGeminiApiKey, setClaudeApiKey, setAiProvider, setNeo4jUri, setNeo4jUser, setNeo4jPassword, setNeo4jDatabase, setWorkdayHours, setWorkdays } = settingsSlice.actions;

export const saveSettings = () => (dispatch, getState) => {
  const settings = getState().settings;
  dispatch(queueAction({ type: 'settings/updateGlobal', payload: settings, meta: { id: Date.now() } }));
};

export default settingsSlice.reducer;
