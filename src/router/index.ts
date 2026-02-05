import { createRouter, createMemoryHistory } from 'vue-router';
import ModeSelection from '../views/ModeSelection.vue';
import CharacterCreation from '../views/CharacterCreation.vue';
// [MING] Removed backend views
// import LoginView from '../views/LoginView.vue';
// import WorkshopView from '../views/WorkshopView.vue';
import GameView from '../views/GameView.vue';
// import AccountCenter from '../views/AccountCenter.vue';
// import BackendAdminView from '../views/BackendAdminView.vue';

// 创建一个包装组件来传递fullscreen属性
import { h } from 'vue';
import { useRouter } from 'vue-router';
import CharacterManagement from '../components/character-creation/CharacterManagement.vue';

const FullscreenCharacterManagement = {
  setup() {
    const router = useRouter();

    const handleClose = () => {
      router.push('/');
    };

    const handleCharacterSelected = (_character: unknown) => {
      router.push('/game');
    };

    return () =>
      h(CharacterManagement, {
        fullscreen: true,
        onClose: handleClose,
        onCharacterSelected: handleCharacterSelected,
      });
  },
};

// 静态导入所有组件，避免代码分割
import MainGamePanel from '../components/dashboard/MainGamePanel.vue';
import MemoryCenterPanel from '../components/dashboard/MemoryCenterPanel.vue';
import CharacterDetailsPanel from '../components/dashboard/CharacterDetailsPanel.vue';
import InventoryPanel from '../components/dashboard/InventoryPanel.vue';
import RelationshipNetworkPanel from '../components/dashboard/RelationshipNetworkPanel.vue';
// [MING] Removed deleted panels: SkillsPanel, ThousandDaoPanel
import SettingsPanel from '../components/dashboard/SettingsPanel.vue';
import SavePanel from '../components/dashboard/SavePanel.vue';
// import WorldMapRoute from '../components/dashboard/WorldMapRoute.vue';
import EventPanel from '../components/dashboard/EventPanel.vue';
import MapPanel from '../components/dashboard/MapPanel.vue';
// [MING] SectPanel, SectSystemPanel, Sect*Content removed (sect system retired)
import GameVariablePanel from '../components/dashboard/GameVariablePanel.vue';
import PromptManagementPanel from '../components/dashboard/PromptManagementPanel.vue';
import PromptAssemblyPanel from '../components/dashboard/PromptAssemblyPanel.vue';
// import OnlineTravelPanel from '../components/dashboard/OnlineTravelPanel.vue';
import APIManagementPanel from '../components/dashboard/APIManagementPanel.vue';

const routes = [
  {
    path: '/',
    name: 'ModeSelection',
    component: ModeSelection,
  },
  {
    path: '/creation',
    name: 'CharacterCreation',
    component: CharacterCreation,
  },
  // [MING] Removed backend routes
  // {
  //   path: '/login',
  //   name: 'Login',
  //   component: LoginView,
  // },
  // {
  //   path: '/workshop',
  //   name: 'Workshop',
  //   component: WorkshopView,
  // },
  // {
  //   path: '/account',
  //   name: 'AccountCenter',
  //   component: AccountCenter,
  // },
  // {
  //   path: '/backend-admin',
  //   name: 'BackendAdmin',
  //   component: BackendAdminView,
  // },
  {
    // 提示词管理 - 独立顶级路由，不需要加载游戏数据
    path: '/prompts',
    name: 'PromptsStandalone',
    component: PromptManagementPanel,
  },
  {
    path: '/game',
    name: 'Game',
    component: GameView,
    children: [
      {
        path: '',
        name: 'GameMain',
        component: MainGamePanel,
      },
      {
        path: 'memory',
        name: 'Memory',
        component: MemoryCenterPanel,
      },
      {
        path: 'character-details',
        name: 'CharacterDetails',
        component: CharacterDetailsPanel,
      },
      {
        path: 'inventory',
        name: 'Inventory',
        component: InventoryPanel,
      },
      {
        path: 'relationships',
        name: 'Relationships',
        component: RelationshipNetworkPanel,
      },
      // [MING] Removed: techniques, thousand-dao
      {
        path: 'settings',
        name: 'Settings',
        component: SettingsPanel,
      },
      {
        path: 'save',
        name: 'Save',
        component: SavePanel,
      },
      // {
      //   path: 'world-map',
      //   name: 'WorldMap',
      //   component: WorldMapRoute,
      // },
      {
        path: 'map',
        name: 'Map',
        component: MapPanel,
      },
      {
        path: 'events',
        name: 'Events',
        component: EventPanel,
      },
      // [MING] Sect route removed (sect system retired)
      {
        path: 'game-variables',
        name: 'GameVariables',
        component: GameVariablePanel,
      },
      {
        path: 'prompts',
        name: 'Prompts',
        component: PromptManagementPanel,
      },
      // {
      //   path: 'travel',
      //   name: 'Travel',
      //   component: OnlineTravelPanel,
      // },
      {
        path: 'api-management',
        name: 'APIManagement',
        component: APIManagementPanel,
      },
      {
        path: 'prompt-assembly',
        name: 'PromptAssembly',
        component: PromptAssemblyPanel,
      },
    ],
  },
  {
    path: '/management',
    name: 'CharacterManagement',
    component: FullscreenCharacterManagement,
  },
];

const router = createRouter({
  history: createMemoryHistory(),
  routes,
});

export default router;
