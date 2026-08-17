import { Ionicons } from '@expo/vector-icons';

import { useCallback, useEffect, useRef, useState } from 'react';

import {

  ActivityIndicator,

  Alert,

  RefreshControl,

  StyleSheet,

  Text,

  TouchableOpacity,

  View,

} from 'react-native';

import { ScrollView } from 'react-native-gesture-handler';

import { LinearGradient } from 'expo-linear-gradient';

import * as Location from 'expo-location';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddWidgetSheet from '../components/dashboard/AddWidgetSheet';

import AiBriefingModal from '../components/dashboard/AiBriefingModal';

import DashboardEditableGrid from '../components/dashboard/DashboardEditableGrid';

import WidgetTrashBin from '../components/dashboard/WidgetTrashBin';

import {

  createWidget,

  loadDashboardLayout,

  resetDashboardLayout,

  saveDashboardLayout,

} from '../lib/dashboardLayout';

import { generateCampusReport } from '../lib/gemini';

import { useNetwork } from '../lib/NetworkContext';

import { REPORT_MODE_INSTANT } from '../lib/reportPreferences';

import { useReportMode } from '../lib/ReportModeContext';

import { supabase } from '../lib/supabase';

import { useTabBarScrollHandler } from '../lib/TabBarScrollContext';

import { getTabBarClearance } from '../lib/tabBarLayout';

import { useTheme } from '../lib/ThemeContext';

import { useFeedback } from '../lib/useFeedback';

import { useTranslation } from 'react-i18next';

import { useProximityOptional } from '../lib/ProximityContext';



export default function DashboardScreen({ navigation }) {

  const insets = useSafeAreaInsets();

  const { t } = useTranslation();

  const scrollRef = useRef(null);

  const trashRef = useRef(null);

  const scrollOffsetRef = useRef(0);

  const { onScroll, scrollEventThrottle } = useTabBarScrollHandler();

  const tabBarPadding = getTabBarClearance(insets);

  const { colors } = useTheme();

  const { isOnline } = useNetwork();

  const { launchReport } = useReportMode();

  const proximity = useProximityOptional();

  const bleCount = proximity ? proximity.getRecentTokenCount() : 0;



  const [reports, setReports] = useState([]);

  const [layout, setLayout] = useState([]);

  const [layoutReady, setLayoutReady] = useState(false);

  const [editMode, setEditMode] = useState(false);

  const [addSheetVisible, setAddSheetVisible] = useState(false);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [userName, setUserName] = useState('');

  const [welcomeMessage, setWelcomeMessage] = useState('Welcome Back,');

  const [aiReport, setAiReport] = useState('');

  const [aiLoading, setAiLoading] = useState(true);

  const [briefingVisible, setBriefingVisible] = useState(false);

  const [briefingGeneratedAt, setBriefingGeneratedAt] = useState(null);

  const [trashActive, setTrashActive] = useState(false);

  const [trashBounds, setTrashBounds] = useState(null);



  const { success, tap } = useFeedback();

  const editFeedback = useFeedback({ silent: true });



  const welcomeMessages = [

    'Welcome Back,',

    "Look who's here,",

    'Ready for the day,',

    'Stay safe,',

    'Good to see you,',

    'Hello again,',

    "Let's check in,",

    "How's it going,",

    'Campus looks safe,',

    'Welcome,',

  ];



  useEffect(() => {

    loadDashboardLayout().then((saved) => {

      setLayout(saved);

      setLayoutReady(true);

    });

  }, []);



  const restoreScrollPosition = useCallback(() => {

    const y = scrollOffsetRef.current;

    requestAnimationFrame(() => {

      scrollRef.current?.scrollTo({ y, animated: false });

    });

  }, []);



  useEffect(() => {

    if (!editMode) {

      setTrashBounds(null);

      setTrashActive(false);

      return;

    }

    restoreScrollPosition();

    const timer = setTimeout(restoreScrollPosition, 80);

    const trashTimer = setTimeout(() => {

      trashRef.current?.measureInWindow((x, y, width, height) => {

        setTrashBounds({ x, y, width, height });

      });

    }, 120);

    return () => {

      clearTimeout(timer);

      clearTimeout(trashTimer);

    };

  }, [editMode, layout, restoreScrollPosition]);



  const persistLayout = useCallback(async (next) => {

    setLayout(next);

    await saveDashboardLayout(next);

  }, []);



  const fetchDashboardData = async () => {

    try {

      let currentUserId = null;

      let currentUserName = 'Student';

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {

        currentUserId = user.id;

        currentUserName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Student';

        setUserName(currentUserName);

      }

      setWelcomeMessage(welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]);



      const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });

      if (error) throw error;

      const fetchedReports = data || [];

      setReports(fetchedReports);



      setAiLoading(true);

      (async () => {

        try {

          const now = Date.now();

          const DAY_MS = 24 * 60 * 60 * 1000;

          const newCount = fetchedReports.filter((r) => now - new Date(r.created_at).getTime() < DAY_MS).length;

          let nearbyCount = null;

          let locString = null;

          try {

            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status === 'granted') {

              const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

              const { latitude: uLat, longitude: uLng } = loc.coords;

              locString = `Lat: ${uLat}, Lng: ${uLng}`;

              const toRad = (d) => (d * Math.PI) / 180;

              nearbyCount = fetchedReports.filter((r) => {

                if (!r.latitude || !r.longitude) return false;

                const dLat = toRad(r.latitude - uLat);

                const dLng = toRad(r.longitude - uLng);

                const a =

                  Math.sin(dLat / 2) ** 2 +

                  Math.cos(toRad(uLat)) * Math.cos(toRad(r.latitude)) * Math.sin(dLng / 2) ** 2;

                const dist = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

                return dist <= 1000;

              }).length;

            }

          } catch (_) {}



          if (!isOnline) {

            setAiReport('AI briefing unavailable offline. Connect to the internet to generate a campus briefing.');

            return;

          }

          

          const userContext = {

            userName: currentUserName,

            personalReportsCount: currentUserId ? fetchedReports.filter((r) => r.user_id === currentUserId).length : 0,

            locationString: locString,

            bleInfo: bleCount,

          };

          const report = await generateCampusReport(fetchedReports, newCount, nearbyCount, userContext);

          setAiReport(report);

          setBriefingGeneratedAt(new Date());

        } catch (aiErr) {

          if (aiErr.message === 'GEMINI_KEY_MISSING') {

            setAiReport('Add your EXPO_PUBLIC_GROQ_API_KEY to .env to enable AI briefings.');

          } else {

            setAiReport('AI briefing temporarily unavailable.');

          }

        } finally {

          setAiLoading(false);

        }

      })();

    } catch (err) {

      console.error('Error fetching dashboard stats:', err.message);

    } finally {

      setLoading(false);

      setRefreshing(false);

    }

  };



  useEffect(() => {

    fetchDashboardData();

  }, []);



  const calculateSafetyScore = () => {

    if (!reports?.length) return { score: 100, label: 'Optimal', color: '#16a34a' };

    const activeReports = reports.filter((r) => r.status !== 'resolved');

    let penalty = 0;

    activeReports.forEach((r) => {

      if (r.category === 'Safety') penalty += 15;

      else if (r.category === 'Vandalism') penalty += 10;

      else if (r.category === 'Maintenance') penalty += 5;

      else penalty += 8;

    });

    const score = Math.max(25, 100 - penalty);

    if (score >= 80) return { score, label: 'Secure & Clear', color: '#16a34a' };

    if (score >= 50) return { score, label: 'Moderate Caution', color: '#d97706' };

    return { score, label: 'High Risk Alert', color: '#dc2626' };

  };



  const statusInfo = calculateSafetyScore();

  const latestAlerts = reports.slice(0, 2);

  const mapReports = reports.filter(

    (r) => r.latitude != null && r.longitude != null && !Number.isNaN(r.latitude)

  );



  const handleUpdateWidget = (id, updates) => {

    persistLayout(layout.map((w) => (w.id === id ? { ...w, ...updates } : w)));

  };



  const handleRemoveWidget = (id) => {

    persistLayout(layout.filter((w) => w.id !== id));

    setTrashActive(false);

  };



  const handleAddWidget = (type) => {

    const widget = createWidget(type);

    if (!widget) return;

    persistLayout([...layout, widget]);

  };



  const handleResetLayout = () => {

    Alert.alert(

      t('dashboard.resetConfirmTitle'),

      t('dashboard.resetConfirmBody'),

      [

        { text: t('common.cancel'), style: 'cancel' },

        {

          text: t('dashboard.reset'),

          style: 'destructive',

          onPress: async () => {

            editFeedback.medium();

            const defaultLayout = await resetDashboardLayout();

            setLayout(defaultLayout);

          },

        },

      ]

    );

  };



  const handleScroll = useCallback(

    (event) => {

      scrollOffsetRef.current = event.nativeEvent.contentOffset.y;

      onScroll?.(event);

    },

    [onScroll]

  );



  const enterEditMode = useCallback(() => {

    setEditMode(true);

  }, []);



  const widgetProps = {

    statusInfo,

    activeCount: reports.filter((r) => r.status !== 'resolved').length,

    aiLoading,

    aiReport,

    latestAlerts,

    reports,

    mapReports,

    colors,

    onOpenFeed: () => navigation.navigate('Campus Feed'),

    onOpenMap: () => navigation.navigate('Campus Map'),

    onOpenAi: () => navigation.navigate('AI Assistant'),

    onInstantReport: () => {

      launchReport(REPORT_MODE_INSTANT);

      navigation.navigate('Report Incident');

    },

    onOpenBriefing: editMode

      ? undefined

      : () => {

          tap();

          setBriefingVisible(true);

        },

  };



  if (loading || !layoutReady) {

    return (

      <View style={styles.centered}>

        <ActivityIndicator size="large" color="#2563eb" />

      </View>

    );

  }



  return (

    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>

      <ScrollView

        ref={scrollRef}

        contentContainerStyle={[

          styles.content,

          { paddingBottom: editMode ? tabBarPadding + 110 : tabBarPadding },

        ]}

        onScroll={handleScroll}

        scrollEventThrottle={scrollEventThrottle}

        maintainVisibleContentPosition={{

          minIndexForVisible: 0,

          autoscrollToTopThreshold: 100,

        }}

        refreshControl={

          editMode ? undefined : (

            <RefreshControl

              refreshing={refreshing}

              onRefresh={() => {

                setRefreshing(true);

                fetchDashboardData();

              }}

              tintColor={colors.primary}

            />

          )

        }

      >

        <View style={styles.headerRow}>

          <View style={{ flex: 1 }}>

            <Text style={[styles.welcomeText, { color: colors.text }]}>{welcomeMessage} {userName}</Text>

            <Text style={[styles.timeHint, { color: colors.textSecondary }]}>

              {editMode

                ? t('dashboard.editHint')

                : colors.dynamicGradients !== false

                  ? t('dashboard.customizeHint', { period: colors.timePeriodLabel })

                  : t('dashboard.classicThemeHint')}

            </Text>

          </View>

          {editMode ? (

            <View style={styles.editActions}>

              <TouchableOpacity

                style={[styles.iconActionBtn, { borderColor: colors.border }]}

                onPress={() => {

                  editFeedback.tap();

                  setAddSheetVisible(true);

                }}

              >

                <Ionicons name="add" size={18} color={colors.primary} />

              </TouchableOpacity>

              <TouchableOpacity

                style={[styles.iconActionBtn, { borderColor: colors.border }]}

                onPress={handleResetLayout}

              >

                <Ionicons name="refresh-outline" size={18} color={colors.primary} />

              </TouchableOpacity>

              <TouchableOpacity

                style={[styles.doneBtn, { backgroundColor: colors.primary }]}

                onPress={() => {

                  success();

                  setEditMode(false);

                }}

              >

                <Text style={styles.doneBtnText}>{t('common.done')}</Text>

              </TouchableOpacity>

            </View>

          ) : (

            <TouchableOpacity

              style={[styles.editBtn, { borderColor: colors.border }]}

              onPress={() => {

                tap();

                enterEditMode();

              }}

            >

              <Ionicons name="create-outline" size={18} color={colors.primary} />

            </TouchableOpacity>

          )}

        </View>



        <DashboardEditableGrid

          layout={layout}

          editMode={editMode}

          colors={colors}

          widgetProps={widgetProps}

          trashBounds={trashBounds}

          onTrashHoverChange={setTrashActive}

          onEnterEditMode={enterEditMode}

          onUpdateWidget={handleUpdateWidget}

          onRemoveWidget={handleRemoveWidget}

        />

      </ScrollView>



      <AddWidgetSheet

        visible={addSheetVisible}

        layout={layout}

        onClose={() => setAddSheetVisible(false)}

        onAdd={handleAddWidget}

        silent

      />



      {editMode && (

        <WidgetTrashBin

          ref={trashRef}

          colors={colors}

          active={trashActive}

          bottomInset={tabBarPadding}

        />

      )}



      <AiBriefingModal

        visible={briefingVisible}

        report={aiReport}

        generatedAt={briefingGeneratedAt}

        onClose={() => setBriefingVisible(false)}

      />

    </LinearGradient>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1 },

  content: { padding: 16 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 },

  welcomeText: { fontSize: 22, fontWeight: '800', marginBottom: 4 },

  timeHint: { fontSize: 12, fontWeight: '600', lineHeight: 16 },

  editBtn: {

    width: 40,

    height: 40,

    borderRadius: 12,

    borderWidth: 1,

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 4,

  },

  editActions: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: 6,

    marginTop: 4,

  },

  iconActionBtn: {

    width: 36,

    height: 36,

    borderRadius: 12,

    borderWidth: 1,

    alignItems: 'center',

    justifyContent: 'center',

  },

  doneBtn: {

    paddingHorizontal: 14,

    paddingVertical: 10,

    borderRadius: 12,

  },

  doneBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

});

