import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Clock,
  LogOut,
  Lock,
  Trash2,
  XCircle,
  PlusCircle,
  Mic,
  MicOff,
  Wallet,
  Scissors,
  CheckCircle2,
  Save,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const SHOP_NAME = 'MUSTAFA ŞAHİN HAİR DESİGN';
const BARBER_MODE_KEY = 'ms_hair_barber_mode';

const TURKISH_HOURS = {
  sıfır: 0,
  bir: 1,
  iki: 2,
  üç: 3,
  dört: 4,
  beş: 5,
  altı: 6,
  yedi: 7,
  sekiz: 8,
  dokuz: 9,
  on: 10,
  'on bir': 11,
  onbir: 11,
  'on iki': 12,
  oniki: 12,
  'on üç': 13,
  onüç: 13,
  'on dört': 14,
  ondört: 14,
  'on beş': 15,
  onbeş: 15,
  'on altı': 16,
  onaltı: 16,
  'on yedi': 17,
  onyedi: 17,
  'on sekiz': 18,
  onsekiz: 18,
  'on dokuz': 19,
  ondokuz: 19,
  yirmi: 20,
  'yirmi bir': 21,
  yirmibir: 21,
  'yirmi iki': 22,
  yirmiiki: 22,
  'yirmi üç': 23,
  yirmiüç: 23,
};

const WEEKDAY_HEADERS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTH_NAMES = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

function getTodayDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateStr(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildMonthGrid(year, monthIndex) {
  const firstDayJs = new Date(year, monthIndex, 1).getDay();
  const mondayOffset = (firstDayJs + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < mondayOffset; i += 1) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({
      day: d,
      dateStr: formatDateStr(year, monthIndex, d),
    });
  }
  return cells;
}

function toMinutes(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function parseVoiceNoteCommand(transcript, defaultServiceDuration = 30) {
  const raw = (transcript || '').trim();
  const clean = raw.toLowerCase().replace(/\s+/g, ' ');

  let hour = null;
  let minute = 0;
  let matchedPattern = '';

  const colonMatch = clean.match(/\b(?:saat\s+)?([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (colonMatch) {
    hour = Number(colonMatch[1]);
    minute = Number(colonMatch[2]);
    matchedPattern = colonMatch[0];
  }

  if (hour === null) {
    const wordKeys = Object.keys(TURKISH_HOURS).sort((a, b) => b.length - a.length);
    for (const word of wordKeys) {
      const regex = new RegExp(
        `\\b(?:saat(?:e|i|ta|te)?\\s+)?${word}(?:\\s+(buçuk|yarım|([0-5]?\\d)))?\\b`,
        'i'
      );
      const m = clean.match(regex);
      if (m) {
        hour = TURKISH_HOURS[word];
        if (m[1] === 'buçuk' || m[1] === 'yarım') minute = 30;
        else if (m[2]) minute = Number(m[2]);
        matchedPattern = m[0];
        break;
      }
    }
  }

  if (hour === null) {
    const numMatch = clean.match(
      /\b(?:saat(?:e|i|ta|te)?\s+)?([01]?\d|2[0-3])(?:\s+(buçuk|yarım|([0-5]?\d)))?\b/
    );
    if (numMatch) {
      hour = Number(numMatch[1]);
      if (numMatch[2] === 'buçuk' || numMatch[2] === 'yarım') minute = 30;
      else if (numMatch[3]) minute = Number(numMatch[3]);
      matchedPattern = numMatch[0];
    }
  }

  let noteText = clean;
  if (matchedPattern) {
    noteText = noteText.replace(matchedPattern, ' ');
  }
  noteText = noteText
    .replace(/\b(saat|saate|randevu|not|ekle|oluştur|al|yap|buçuk|yarım|dakika|dk)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!noteText) {
    noteText = 'Randevu Notu';
  } else {
    noteText = noteText.charAt(0).toUpperCase() + noteText.slice(1);
  }

  const startTime =
    hour !== null
      ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      : null;

  const endTotal =
    hour !== null ? hour * 60 + minute + Number(defaultServiceDuration || 30) : null;
  const endTime =
    endTotal !== null
      ? `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`
      : null;

  return {
    raw,
    note: noteText,
    startTime,
    endTime,
  };
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('appointments');

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [selectedDate, setSelectedDate] = useState(getTodayDateStr());
  const [appointments, setAppointments] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [services, setServices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [statusBanner, setStatusBanner] = useState('');

  // Görsel ay takvimi state'leri
  const nowInitial = new Date();
  const [calYear, setCalYear] = useState(nowInitial.getFullYear());
  const [calMonth, setCalMonth] = useState(nowInitial.getMonth());
  const [pickedCalDate, setPickedCalDate] = useState(getTodayDateStr());
  const [calOpenTime, setCalOpenTime] = useState('09:00');
  const [calCloseTime, setCalCloseTime] = useState('21:00');
  const [calIsClosed, setCalIsClosed] = useState(false);
  const [savedCalendarDates, setSavedCalendarDates] = useState({});

  // Manuel randevu ekleme formu
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualServiceId, setManualServiceId] = useState('');
  const [manualStartTime, setManualStartTime] = useState('17:00');
  const [manualCollected, setManualCollected] = useState('');

  // Sesli randevu / not + onay durumu
  const [listening, setListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceFeedback, setVoiceFeedback] = useState('');
  const [pendingVoiceDraft, setPendingVoiceDraft] = useState(null);
  const [savingVoiceDraft, setSavingVoiceDraft] = useState(false);
  const recognitionRef = useRef(null);

  // Saat kapatma formu
  const [blockStart, setBlockStart] = useState('12:00');
  const [blockEnd, setBlockEnd] = useState('13:00');
  const [blockReason, setBlockReason] = useState('Mola');

  // Yeni hizmet formu
  const [newSrvName, setNewSrvName] = useState('');
  const [newSrvDuration, setNewSrvDuration] = useState('30');
  const [newSrvPrice, setNewSrvPrice] = useState('250');

  // Günlük harcama formu
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  // Tahsilat tutarları
  const [collectInputs, setCollectInputs] = useState({});

  function showNotice(msg) {
    setStatusBanner(msg);
    setTimeout(() => {
      setStatusBanner((prev) => (prev === msg ? '' : prev));
    }, 3500);
  }

  useEffect(() => {
    window.localStorage.setItem(BARBER_MODE_KEY, 'true');

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    async function loadMeta() {
      const [{ data: srvData }, { data: whRows }] = await Promise.all([
        supabase.from('services').select('*').order('id', { ascending: true }),
        supabase.from('date_working_hours').select('*'),
      ]);

      if (srvData && srvData.length > 0) {
        setServices(srvData);
        setManualServiceId((prev) => prev || String(srvData[0].id));
      }

      if (whRows && whRows.length > 0) {
        const map = {};
        whRows.forEach((r) => {
          map[r.work_date] = {
            open_time: (r.open_time || '09:00:00').slice(0, 5),
            close_time: (r.close_time || '21:00:00').slice(0, 5),
            is_closed: Boolean(r.is_closed),
          };
        });
        setSavedCalendarDates(map);

        const initialPicked = map[getTodayDateStr()];
        if (initialPicked) {
          setCalOpenTime(initialPicked.open_time);
          setCalCloseTime(initialPicked.close_time);
          setCalIsClosed(initialPicked.is_closed);
        }
      }
    }
    loadMeta();
  }, [session]);

  useEffect(() => {
    if (!session || !selectedDate) return;

    async function loadDaySchedule() {
      setLoadingData(true);
      const [{ data: appts }, { data: blocks }, { data: expData }] = await Promise.all([
        supabase
          .from('appointments')
          .select('*, services(name, price, duration_minutes)')
          .eq('appointment_date', selectedDate)
          .neq('status', 'cancelled')
          .order('start_time', { ascending: true }),
        supabase
          .from('blocked_slots')
          .select('*')
          .eq('block_date', selectedDate)
          .order('start_time', { ascending: true }),
        supabase
          .from('expenses')
          .select('*')
          .eq('expense_date', selectedDate)
          .order('id', { ascending: false }),
      ]);

      const apptList = appts || [];
      setAppointments(apptList);
      setBlockedSlots(blocks || []);
      setExpenses(expData || []);

      const initialCollect = {};
      apptList.forEach((a) => {
        initialCollect[a.id] =
          a.collected_amount !== null && a.collected_amount !== undefined
            ? String(a.collected_amount)
            : String(a.services?.price ?? '');
      });
      setCollectInputs(initialCollect);
      setLoadingData(false);
    }

    loadDaySchedule();
  }, [session, selectedDate]);

  const monthCells = useMemo(() => buildMonthGrid(calYear, calMonth), [calYear, calMonth]);

  function handlePrevMonth() {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  }

  function handleSelectCalendarDay(dateStr) {
    setPickedCalDate(dateStr);
    setSelectedDate(dateStr);
    const existing = savedCalendarDates[dateStr];
    if (existing) {
      setCalOpenTime(existing.open_time);
      setCalCloseTime(existing.close_time);
      setCalIsClosed(existing.is_closed);
    } else {
      setCalOpenTime('09:00');
      setCalCloseTime('21:00');
      setCalIsClosed(false);
    }
  }

  async function handleSaveCalendarDayHours(e) {
    e.preventDefault();
    if (!pickedCalDate) return;

    const payload = {
      work_date: pickedCalDate,
      open_time: `${calOpenTime}:00`,
      close_time: `${calCloseTime}:00`,
      is_closed: Boolean(calIsClosed),
    };

    const { error } = await supabase
      .from('date_working_hours')
      .upsert(payload, { onConflict: 'work_date' });

    if (!error) {
      setSavedCalendarDates((prev) => ({
        ...prev,
        [pickedCalDate]: {
          open_time: calOpenTime,
          close_time: calCloseTime,
          is_closed: Boolean(calIsClosed),
        },
      }));
      showNotice(
        `Tamamlandı: ${pickedCalDate} çalışma saati ${
          calIsClosed ? 'Kapalı' : `${calOpenTime} - ${calCloseTime}`
        } olarak eklendi.`
      );
    } else {
      showNotice('Çalışma saati kaydedilirken hata oluştu.');
    }
  }

  const cashSummary = useMemo(() => {
    const totalIncome = appointments.reduce((sum, a) => {
      const val =
        a.collected_amount !== null && a.collected_amount !== undefined
          ? Number(a.collected_amount)
          : a.is_completed
          ? Number(a.services?.price || 0)
          : 0;
      return sum + (Number.isNaN(val) ? 0 : val);
    }, 0);

    const expectedIncome = appointments.reduce(
      (sum, a) => sum + Number(a.services?.price || 0),
      0
    );

    const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netCash = totalIncome - totalExpense;

    return { totalIncome, expectedIncome, totalExpense, netCash };
  }, [appointments, expenses]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    window.localStorage.setItem(BARBER_MODE_KEY, 'true');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoginError('E-posta veya şifre hatalı.');
    } else {
      showNotice('Giriş başarılı.');
    }
  }

  async function handleLogout() {
    window.localStorage.setItem(BARBER_MODE_KEY, 'false');
    await supabase.auth.signOut();
    setSession(null);
    showNotice('Oturum kapatıldı.');
  }

  function hasSlotConflict(startTimeHHMM, durationMinutes) {
    const newStart = toMinutes(startTimeHHMM);
    const newEnd = newStart + Number(durationMinutes || 30);

    const hasAppt = appointments.some((a) => {
      const aStart = toMinutes(a.start_time);
      const aEnd = toMinutes(a.end_time);
      return newStart < aEnd && newEnd > aStart;
    });

    if (hasAppt) {
      return 'Bu saat aralığında zaten başka bir randevu kayıtlı!';
    }

    const hasBlock = blockedSlots.some((b) => {
      const bStart = toMinutes(b.start_time);
      const bEnd = toMinutes(b.end_time);
      return newStart < bEnd && newEnd > bStart;
    });

    if (hasBlock) {
      return 'Bu saat aralığı kapalı / mola olarak işaretlenmiş!';
    }

    return null;
  }

  async function createAppointmentRecord({
    customerName,
    customerPhone = 'Dükkan Kayıt',
    serviceId,
    startTimeHHMM,
    collectedAmount = null,
    isCompleted = false,
  }) {
    const srv = services.find((s) => String(s.id) === String(serviceId)) || services[0];
    if (!srv) {
      showNotice('Önce en az bir hizmet tanımlayın.');
      return false;
    }

    const conflictMsg = hasSlotConflict(startTimeHHMM, srv.duration_minutes);
    if (conflictMsg) {
      showNotice(conflictMsg);
      return false;
    }

    const [h, m] = startTimeHHMM.split(':').map(Number);
    const totalEnd = h * 60 + m + Number(srv.duration_minutes || 30);
    const endTime = `${String(Math.floor(totalEnd / 60) % 24).padStart(2, '0')}:${String(totalEnd % 60).padStart(2, '0')}:00`;

    const { data, error } = await supabase
      .from('appointments')
      .insert([
        {
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || 'Dükkan Kayıt',
          service_id: srv.id,
          appointment_date: selectedDate,
          start_time: `${startTimeHHMM}:00`,
          end_time: endTime,
          status: 'confirmed',
          collected_amount:
            collectedAmount !== null && collectedAmount !== '' ? Number(collectedAmount) : null,
          is_completed: Boolean(isCompleted),
        },
      ])
      .select('*, services(name, price, duration_minutes)')
      .single();

    if (!error && data) {
      setAppointments((prev) =>
        [...prev, data].sort((a, b) => a.start_time.localeCompare(b.start_time))
      );
      setCollectInputs((prev) => ({
        ...prev,
        [data.id]:
          data.collected_amount !== null && data.collected_amount !== undefined
            ? String(data.collected_amount)
            : String(data.services?.price ?? ''),
      }));
      return true;
    }

    showNotice('Kayıt eklenirken bir hata oluştu.');
    return false;
  }

  async function handleAddManualAppointment(e) {
    e.preventDefault();
    if (!manualName.trim()) {
      showNotice('Lütfen müşteri adı veya not girin.');
      return;
    }

    const ok = await createAppointmentRecord({
      customerName: manualName,
      customerPhone: manualPhone,
      serviceId: manualServiceId,
      startTimeHHMM: manualStartTime,
      collectedAmount: manualCollected !== '' ? Number(manualCollected) : null,
      isCompleted: manualCollected !== '',
    });

    if (ok) {
      setManualName('');
      setManualPhone('');
      setManualCollected('');
      showNotice(`Başarılı: Saat ${manualStartTime} randevusu eklendi.`);
    }
  }

  function prepareVoiceDraft(rawTranscript) {
    const cleanInput = (rawTranscript || '').trim();
    if (!cleanInput) {
      setVoiceFeedback('Lütfen önce konuşun veya metin yazın.');
      return;
    }

    const defaultDur =
      services.find((s) => String(s.id) === String(manualServiceId))?.duration_minutes || 30;
    const parsed = parseVoiceNoteCommand(cleanInput, defaultDur);

    const resolvedStartTime = parsed.startTime || manualStartTime || '17:00';
    const resolvedNote =
      parsed.note && parsed.note !== 'Randevu Notu'
        ? parsed.note
        : cleanInput.charAt(0).toUpperCase() + cleanInput.slice(1);

    setPendingVoiceDraft({
      rawText: cleanInput,
      startTime: resolvedStartTime,
      note: resolvedNote,
      serviceId: manualServiceId || (services[0] ? String(services[0].id) : ''),
    });
    setVoiceFeedback(
      `Metin ve saat hazır: ${resolvedStartTime} — "${resolvedNote}". Eklemek için "Saati ve Notu Onayla"ya basın.`
    );
  }

  async function handleConfirmVoiceDraft() {
    if (!pendingVoiceDraft || savingVoiceDraft) return;
    setSavingVoiceDraft(true);

    const ok = await createAppointmentRecord({
      customerName: pendingVoiceDraft.note,
      customerPhone: 'Sesli / Not Kayıt',
      serviceId: pendingVoiceDraft.serviceId,
      startTimeHHMM: pendingVoiceDraft.startTime,
    });

    setSavingVoiceDraft(false);

    if (ok) {
      const addedTime = pendingVoiceDraft.startTime;
      const addedNote = pendingVoiceDraft.note;
      setPendingVoiceDraft(null);
      setVoiceText('');
      setVoiceFeedback(`Onaylandı ve eklendi: ${addedTime} — "${addedNote}"`);
      showNotice(`Tamamlandı: Saat ${addedTime} "${addedNote}" eklendi.`);
    }
  }

  function handleToggleMicrophone() {
    if (listening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setListening(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceFeedback(
        'Tarayıcıda ses tanıma açık değil. Metni alttaki kutuya yazıp onaylayabilirsiniz.'
      );
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'tr-TR';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      let latestTranscript = '';

      setListening(true);
      setVoiceFeedback('Dinliyorum... Konuşun (Örn: "Saat beş Ahmet saç sakal")');

      recognition.onresult = (event) => {
        let combined = '';
        for (let i = 0; i < event.results.length; i += 1) {
          combined += ` ${event.results[i][0]?.transcript || ''}`;
        }
        latestTranscript = combined.trim();
        if (latestTranscript) {
          setVoiceText(latestTranscript);
          setVoiceFeedback(`Yazılıyor: "${latestTranscript}"`);
        }
      };

      recognition.onerror = (event) => {
        setListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceFeedback(
            'Tarayıcı mikrofon izni engelli görünüyor. Adres çubuğundaki mikrofon/site iznini Açık yapın veya metni aşağıya yazın.'
          );
        } else if (event.error === 'network') {
          setVoiceFeedback(
            'Tarayıcı ses servisine bağlanamadı. Metni alttaki kutuya yazıp onaylayabilirsiniz.'
          );
        } else if (event.error === 'no-speech') {
          setVoiceFeedback('Ses algılanmadı. Mikrofona tekrar basıp konuşun.');
        } else {
          setVoiceFeedback(`Ses durumu (${event.error}). Metni kutuya yazıp onaylayabilirsiniz.`);
        }
      };

      recognition.onend = () => {
        setListening(false);
        if (latestTranscript) {
          prepareVoiceDraft(latestTranscript);
        }
      };

      recognition.start();
    } catch {
      setListening(false);
      setVoiceFeedback('Ses dinleme başlatılamadı; metni kutuya yazıp onaylayabilirsiniz.');
    }
  }

  async function handleCompleteAndCollect(appt) {
    const rawAmount = collectInputs[appt.id];
    const amountNum =
      rawAmount !== undefined && rawAmount !== ''
        ? Number(rawAmount)
        : Number(appt.services?.price || 0);

    const { data, error } = await supabase
      .from('appointments')
      .update({
        is_completed: true,
        collected_amount: Number.isNaN(amountNum) ? 0 : amountNum,
      })
      .eq('id', appt.id)
      .select('*, services(name, price, duration_minutes)')
      .single();

    if (!error && data) {
      setAppointments((prev) => prev.map((item) => (item.id === appt.id ? data : item)));
      showNotice(`Tamamlandı: ${appt.customer_name} için ${data.collected_amount} TL kasaya eklendi.`);
    }
  }

  async function handleCancelAppointment(id) {
    const { error } = await supabase.from('appointments').delete().eq('id', id);

    if (!error) {
      setAppointments((prev) => prev.filter((a) => a.id !== id));
      showNotice('Randevu silindi ve listeden çıkarıldı.');
    }
  }

  async function handleAddBlock(e) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('blocked_slots')
      .insert([
        {
          block_date: selectedDate,
          start_time: `${blockStart}:00`,
          end_time: `${blockEnd}:00`,
          reason: blockReason.trim() || 'Mola',
        },
      ])
      .select()
      .single();

    if (!error && data) {
      setBlockedSlots((prev) => [...prev, data]);
      showNotice(`Eklendi: ${blockStart} - ${blockEnd} kapalı saat kaydı oluşturuldu.`);
    }
  }

  async function handleDeleteBlock(id) {
    const { error } = await supabase.from('blocked_slots').delete().eq('id', id);
    if (!error) {
      setBlockedSlots((prev) => prev.filter((b) => b.id !== id));
      showNotice('Kapalı saat kaydı kaldırıldı.');
    }
  }

  function handleServiceLocalChange(id, field, value) {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }

  async function handleSaveService(srv) {
    const { error } = await supabase
      .from('services')
      .update({
        name: srv.name.trim(),
        duration_minutes: Number(srv.duration_minutes) || 30,
        price: Number(srv.price) || 0,
      })
      .eq('id', srv.id);

    if (!error) {
      showNotice(`Başarılı: "${srv.name}" fiyatı güncellendi.`);
    }
  }

  async function handleAddService(e) {
    e.preventDefault();
    if (!newSrvName.trim()) return;

    const { data, error } = await supabase
      .from('services')
      .insert([
        {
          name: newSrvName.trim(),
          duration_minutes: Number(newSrvDuration) || 30,
          price: Number(newSrvPrice) || 0,
        },
      ])
      .select()
      .single();

    if (!error && data) {
      setServices((prev) => [...prev, data]);
      setNewSrvName('');
      setNewSrvDuration('30');
      setNewSrvPrice('250');
      showNotice(`Eklendi: "${data.name}" hizmeti oluşturuldu.`);
    }
  }

  async function handleAddExpense(e) {
    e.preventDefault();
    if (!expenseTitle.trim() || !expenseAmount) return;

    const { data, error } = await supabase
      .from('expenses')
      .insert([
        {
          expense_date: selectedDate,
          title: expenseTitle.trim(),
          amount: Number(expenseAmount),
        },
      ])
      .select()
      .single();

    if (!error && data) {
      setExpenses((prev) => [data, ...prev]);
      setExpenseTitle('');
      setExpenseAmount('');
      showNotice(`Eklendi: ${data.amount} TL harcama kasaya işlendi.`);
    }
  }

  async function handleDeleteExpense(id) {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      showNotice('Harcama kaydı silindi.');
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Oturum kontrol ediliyor...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-lg"
        >
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <Lock className="w-5 h-5 text-amber-600" />
            <span>{SHOP_NAME}</span>
          </div>
          <p className="text-xs text-slate-500">
            Berber yönetim girişi. Giriş yaptıktan sonra çıkış yapmadığınız sürece ekran açık kalır.
          </p>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">E-posta</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Şifre</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {loginError && <p className="text-xs text-red-600">{loginError}</p>}
          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl text-sm"
          >
            Giriş Yap
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <div className="max-w-2xl mx-auto pt-4 px-3.5 space-y-4">
        <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <h1 className="text-sm font-bold tracking-wide text-amber-400">{SHOP_NAME}</h1>
            <p className="text-[11px] text-slate-300">{session.user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs font-semibold text-rose-300 hover:text-rose-200 bg-white/10 px-2.5 py-1.5 rounded-xl"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Çıkış</span>
          </button>
        </div>

        {statusBanner && (
          <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm">
            {statusBanner}
          </div>
        )}

        {(activeTab === 'appointments' || activeTab === 'cash' || activeTab === 'mic') && (
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 flex items-center justify-between gap-3">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-600" />
              <span>Tarih:</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium"
            />
          </div>
        )}

        {/* PANEL 1: RANDEVULAR */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  Günlük Randevular ({selectedDate})
                </h2>
                <span className="text-xs font-semibold text-slate-500">
                  {appointments.length} randevu
                </span>
              </div>

              {loadingData ? (
                <p className="text-xs text-slate-400">Randevular yükleniyor...</p>
              ) : appointments.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center bg-slate-50 rounded-xl">
                  Bu gün için aktif randevu bulunmuyor.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {appointments.map((appt, idx) => (
                    <div
                      key={appt.id}
                      className={`p-3 rounded-xl border text-sm space-y-2 ${
                        appt.is_completed
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900">
                            {idx + 1}. {appt.start_time.slice(0, 5)} - {appt.end_time.slice(0, 5)} •{' '}
                            {appt.customer_name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {appt.services?.name} (Liste: {appt.services?.price} TL) •{' '}
                            {appt.customer_phone}
                          </div>
                        </div>
                        {appt.is_completed && (
                          <span className="text-xs font-semibold text-emerald-700">
                            {appt.collected_amount} TL Alındı
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={collectInputs[appt.id] ?? ''}
                            onChange={(e) =>
                              setCollectInputs((prev) => ({
                                ...prev,
                                [appt.id]: e.target.value,
                              }))
                            }
                            placeholder="TL"
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleCompleteAndCollect(appt)}
                            className="flex items-center gap-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Kasaya İşle</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCancelAppointment(appt.id)}
                          className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>İptal</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={handleAddManualAppointment}
              className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3"
            >
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-slate-600" />
                <span>Manuel Randevu Ekle</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  placeholder="Müşteri Ad Soyad / Not"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="tel"
                  placeholder="Telefon (opsiyonel)"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  value={manualServiceId}
                  onChange={(e) => setManualServiceId(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes} dk • {s.price} TL)
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={manualStartTime}
                    onChange={(e) => setManualStartTime(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm flex-1"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Alınan TL"
                    value={manualCollected}
                    onChange={(e) => setManualCollected(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm w-24"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 rounded-xl"
              >
                Ajandaya Ekle
              </button>
            </form>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-600" />
                <span>Saat Aralığı Kapat (Mola / İzin)</span>
              </h2>
              <form onSubmit={handleAddBlock} className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                  className="rounded-xl border border-slate-300 px-2.5 py-2 text-sm"
                />
                <input
                  type="time"
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                  className="rounded-xl border border-slate-300 px-2.5 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Sebep (Mola vb.)"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm flex-1 min-w-[120px]"
                />
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl"
                >
                  Kapat
                </button>
              </form>

              {blockedSlots.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {blockedSlots.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between text-xs bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"
                    >
                      <span>
                        {b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)} • {b.reason}
                      </span>
                      <button
                        onClick={() => handleDeleteBlock(b.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Kapatmayı Kaldır"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANEL 2: MİKROFON & ONAYLI NOT */}
        {activeTab === 'mic' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center text-center space-y-4">
            <h2 className="text-base font-bold text-slate-900">Sesli Saat &amp; Not Kaydı</h2>
            <p className="text-xs text-slate-500 max-w-sm">
              Mikrofona bir kez basın; metni ve saati algılasın, ardından onayladığınızda randevuya eklesin.
            </p>

            <button
              type="button"
              onClick={handleToggleMicrophone}
              className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg transition ${
                listening
                  ? 'bg-red-600 text-white animate-pulse scale-105'
                  : 'bg-slate-900 hover:bg-slate-800 text-amber-400'
              }`}
              title="Mikrofonu Aç / Kapat"
            >
              {listening ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
            </button>

            <div className="text-xs font-semibold text-slate-700">
              {listening ? 'Dinleniyor... Konuşun' : 'Dinlemek için mikrofona basın'}
            </div>

            {voiceFeedback && (
              <div className="w-full text-xs bg-slate-100 border border-slate-200 text-slate-800 rounded-xl p-3">
                {voiceFeedback}
              </div>
            )}

            <div className="w-full pt-3 border-t border-slate-100 space-y-2.5 text-left">
              <label className="text-xs font-semibold text-slate-700 block">
                Algılanan / Yazılan Metin ve Saat
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={voiceText}
                  onChange={(e) => setVoiceText(e.target.value)}
                  placeholder='Örn: "Saat beş Ahmet saç sakal"'
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => prepareVoiceDraft(voiceText)}
                  className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl"
                >
                  Hazırla
                </button>
              </div>

              {pendingVoiceDraft && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-3">
                  <div className="text-xs font-bold text-slate-900">
                    Onay Bekleyen Kayıt ({selectedDate})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-1">Saat</label>
                      <input
                        type="time"
                        value={pendingVoiceDraft.startTime}
                        onChange={(e) =>
                          setPendingVoiceDraft((prev) => ({
                            ...prev,
                            startTime: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-1">Not / Müşteri</label>
                      <input
                        type="text"
                        value={pendingVoiceDraft.note}
                        onChange={(e) =>
                          setPendingVoiceDraft((prev) => ({
                            ...prev,
                            note: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white font-semibold"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={savingVoiceDraft}
                      onClick={handleConfirmVoiceDraft}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-semibold py-2.5 rounded-xl"
                    >
                      {savingVoiceDraft ? 'Ekleniyor...' : 'Saati Onayla ve Randevuya Ekle'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingVoiceDraft(null);
                        setVoiceFeedback('Taslak iptal edildi.');
                      }}
                      className="bg-white border border-slate-300 text-slate-700 text-xs font-semibold px-3 py-2.5 rounded-xl"
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANEL 3: KASA */}
        {activeTab === 'cash' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>Kasa ({selectedDate})</span>
              </h2>
              <span className="text-[11px] text-slate-500">
                Liste Toplamı: {cashSummary.expectedIncome} TL
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                <div className="text-[11px] text-emerald-700 font-medium">Gelir</div>
                <div className="text-base font-bold text-emerald-900 mt-0.5">
                  {cashSummary.totalIncome} TL
                </div>
              </div>
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                <div className="text-[11px] text-rose-700 font-medium">Harcama</div>
                <div className="text-base font-bold text-rose-900 mt-0.5">
                  {cashSummary.totalExpense} TL
                </div>
              </div>
              <div className="rounded-xl bg-slate-900 text-white p-3">
                <div className="text-[11px] text-slate-300 font-medium">Net Kasa</div>
                <div className="text-base font-bold mt-0.5">{cashSummary.netCash} TL</div>
              </div>
            </div>

            <form onSubmit={handleAddExpense} className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Harcama açıklaması (Örn: Jilet, çay, kira)"
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm flex-1 min-w-[160px]"
              />
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="Tutar TL"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm w-28"
              />
              <button
                type="submit"
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                Harcama Ekle
              </button>
            </form>

            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-700">Günlük Harcamalar</div>
              {expenses.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">Bugün kayıtlı harcama yok.</p>
              ) : (
                expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    <span className="font-medium text-slate-800">{exp.title}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-rose-600">-{exp.amount} TL</span>
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="text-slate-400 hover:text-red-600"
                        title="Harcamayı Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* PANEL 4: GÖRSEL AY TAKVİMİ İLE ÇALIŞMA SAATİ & FİYATLAR */}
        {activeTab === 'hours' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-slate-600" />
                  <span>Takvim Çalışma Saatleri</span>
                </h2>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                    title="Önceki Ay"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-800 min-w-[96px] text-center">
                    {MONTH_NAMES[calMonth]} {calYear}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                    title="Sonraki Ay"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-500">
                {WEEKDAY_HEADERS.map((wd) => (
                  <div key={wd} className="py-1">
                    {wd}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {monthCells.map((cell, idx) => {
                  if (!cell) {
                    return <div key={`empty-${idx}`} className="h-11" />;
                  }
                  const isPicked = cell.dateStr === pickedCalDate;
                  const savedInfo = savedCalendarDates[cell.dateStr];
                  const isClosedDay = Boolean(savedInfo?.is_closed);

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => handleSelectCalendarDay(cell.dateStr)}
                      className={`h-11 rounded-xl flex flex-col items-center justify-center border text-xs font-bold transition relative ${
                        isPicked
                          ? 'bg-slate-900 text-amber-400 border-slate-900 shadow-sm'
                          : isClosedDay
                          ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          : savedInfo
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{cell.day}</span>
                      {savedInfo && (
                        <span className="text-[9px] font-semibold leading-none mt-0.5">
                          {isClosedDay ? 'Kapalı' : savedInfo.close_time}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <form
                onSubmit={handleSaveCalendarDayHours}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">Seçili Gün: {pickedCalDate}</span>
                  <label className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={calIsClosed}
                      onChange={(e) => setCalIsClosed(e.target.checked)}
                    />
                    <span>Bu Gün Kapalı</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      disabled={calIsClosed}
                      value={calOpenTime}
                      onChange={(e) => setCalOpenTime(e.target.value)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white disabled:opacity-40"
                    />
                    <span className="font-bold">-</span>
                    <input
                      type="time"
                      disabled={calIsClosed}
                      value={calCloseTime}
                      onChange={(e) => setCalCloseTime(e.target.value)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white disabled:opacity-40"
                    />
                  </div>

                  <button
                    type="submit"
                    className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Günü Kaydet</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-slate-600" />
                <span>Hizmetler ve Fiyat Düzenleme</span>
              </h2>
              <div className="space-y-2">
                {services.map((srv) => (
                  <div
                    key={srv.id}
                    className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                  >
                    <input
                      type="text"
                      value={srv.name}
                      onChange={(e) => handleServiceLocalChange(srv.id, 'name', e.target.value)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium bg-white flex-1 min-w-[120px]"
                    />
                    <input
                      type="number"
                      min="5"
                      step="5"
                      value={srv.duration_minutes}
                      onChange={(e) =>
                        handleServiceLocalChange(srv.id, 'duration_minutes', e.target.value)
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white w-16"
                    />
                    <span className="text-[11px] text-slate-500">dk</span>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={srv.price}
                      onChange={(e) => handleServiceLocalChange(srv.id, 'price', e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold bg-white w-20"
                    />
                    <span className="text-[11px] text-slate-500">TL</span>
                    <button
                      type="button"
                      onClick={() => handleSaveService(srv)}
                      className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Kaydet</span>
                    </button>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleAddService}
                className="flex flex-wrap gap-2 pt-2 border-t border-slate-100"
              >
                <input
                  type="text"
                  placeholder="Yeni hizmet adı"
                  value={newSrvName}
                  onChange={(e) => setNewSrvName(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs flex-1 min-w-[120px]"
                />
                <input
                  type="number"
                  min="5"
                  placeholder="Dk"
                  value={newSrvDuration}
                  onChange={(e) => setNewSrvDuration(e.target.value)}
                  className="rounded-xl border border-slate-300 px-2 py-2 text-xs w-16"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="TL"
                  value={newSrvPrice}
                  onChange={(e) => setNewSrvPrice(e.target.value)}
                  className="rounded-xl border border-slate-300 px-2 py-2 text-xs w-20"
                />
                <button
                  type="submit"
                  className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-3.5 py-2 rounded-xl"
                >
                  Ekle
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ALT NAV BAR */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 shadow-lg z-20">
        <div className="max-w-2xl mx-auto grid grid-cols-4 items-center px-1 py-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('appointments')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-semibold transition ${
              activeTab === 'appointments'
                ? 'text-slate-900 bg-slate-100'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span>Randevular</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mic')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-semibold transition ${
              activeTab === 'mic'
                ? 'text-amber-700 bg-amber-50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Mic className="w-5 h-5 mb-0.5" />
            <span>Mikrofon</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cash')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-semibold transition ${
              activeTab === 'cash'
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wallet className="w-5 h-5 mb-0.5" />
            <span>Kasa</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hours')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-semibold transition ${
              activeTab === 'hours'
                ? 'text-slate-900 bg-slate-100'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-5 h-5 mb-0.5" />
            <span>Saatler</span>
          </button>
        </div>
      </nav>
    </div>
  );
}