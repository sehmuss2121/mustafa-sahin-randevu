import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Scissors, CheckCircle2, MessageCircle, User, Phone } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getAvailableSlots } from '../utils/timeSlots';

const BARBER_WHATSAPP = '905XXXXXXXXX'; // Kuzeninin WhatsApp numarası (başında 90 ile)
const SHOP_NAME = 'MUSTAFA ŞAHİN HAİR DESİGN';

function getTodayDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function BookingPage() {
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr());
  const [dateSchedule, setDateSchedule] = useState({
    open_time: '09:00:00',
    close_time: '21:00:00',
    is_closed: false,
  });
  const [appointments, setAppointments] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdBooking, setCreatedBooking] = useState(null);

  useEffect(() => {
    async function fetchServices() {
      setLoadingServices(true);
      const { data: srvData, error: srvError } = await supabase
        .from('services')
        .select('*')
        .order('id', { ascending: true });

      if (!srvError && srvData && srvData.length > 0) {
        setServices(srvData);
        setSelectedServiceId((prev) => prev ?? srvData[0].id);
      }
      setLoadingServices(false);
    }
    fetchServices();
  }, []);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) || null,
    [services, selectedServiceId]
  );

  useEffect(() => {
    if (!selectedDate) return;

    async function fetchDayData() {
      setLoadingSlots(true);
      setSelectedSlot(null);

      const [{ data: appts }, { data: blocks }, { data: whRow }] = await Promise.all([
        supabase
          .from('appointments')
          .select('start_time, end_time, status')
          .eq('appointment_date', selectedDate)
          .neq('status', 'cancelled'),
        supabase
          .from('blocked_slots')
          .select('start_time, end_time')
          .eq('block_date', selectedDate),
        supabase
          .from('date_working_hours')
          .select('*')
          .eq('work_date', selectedDate)
          .maybeSingle(),
      ]);

      setAppointments(appts || []);
      setBlockedSlots(blocks || []);
      setDateSchedule(
        whRow || {
          open_time: '09:00:00',
          close_time: '21:00:00',
          is_closed: false,
        }
      );
      setLoadingSlots(false);
    }

    fetchDayData();
  }, [selectedDate]);

  const availableSlots = useMemo(() => {
    if (!selectedService || !dateSchedule) return [];
    return getAvailableSlots({
      dateStr: selectedDate,
      durationMinutes: selectedService.duration_minutes,
      appointments,
      blockedSlots,
      openTime: dateSchedule.open_time,
      closeTime: dateSchedule.close_time,
      isClosed: dateSchedule.is_closed,
    });
  }, [selectedDate, selectedService, dateSchedule, appointments, blockedSlots]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedService || !selectedSlot) {
      setErrorMsg('Lütfen hizmet ve uygun bir saat seçin.');
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      setErrorMsg('Lütfen ad soyad ve telefon numarası girin.');
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase
      .from('appointments')
      .insert([
        {
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          service_id: selectedService.id,
          appointment_date: selectedDate,
          start_time: `${selectedSlot.start_time}:00`,
          end_time: `${selectedSlot.end_time}:00`,
          status: 'confirmed',
        },
      ])
      .select()
      .single();

    setSubmitting(false);

    if (error) {
      setErrorMsg('Randevu kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.');
      return;
    }

    setCreatedBooking({
      ...data,
      serviceName: selectedService.name,
      price: selectedService.price,
    });
    setAppointments((prev) => [
      ...prev,
      {
        start_time: `${selectedSlot.start_time}:00`,
        end_time: `${selectedSlot.end_time}:00`,
        status: 'confirmed',
      },
    ]);
  }

  function buildWhatsAppUrl(booking) {
    const text = `Merhaba ${SHOP_NAME}, ${booking.appointment_date} tarihinde saat ${booking.start_time.slice(0, 5)} için "${booking.serviceName}" randevusu oluşturdum. Ad Soyad: ${booking.customer_name}, Tel: ${booking.customer_phone}`;
    return `https://wa.me/${BARBER_WHATSAPP}?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">{SHOP_NAME}</h1>
            <p className="text-xs text-slate-500">Hızlı Online Randevu</p>
          </div>
        </div>

        {createdBooking ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              <span>Randevunuz Oluşturuldu</span>
            </div>
            <div className="text-sm text-slate-700 space-y-1">
              <p><span className="font-medium">Müşteri:</span> {createdBooking.customer_name}</p>
              <p><span className="font-medium">Hizmet:</span> {createdBooking.serviceName}</p>
              <p><span className="font-medium">Tarih &amp; Saat:</span> {createdBooking.appointment_date} • {createdBooking.start_time.slice(0, 5)}</p>
              <p><span className="font-medium">Ücret:</span> {createdBooking.price} TL</p>
            </div>
            <a
              href={buildWhatsAppUrl(createdBooking)}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp&apos;tan Randevu Bilgisi Gönder</span>
            </a>
            <button
              type="button"
              onClick={() => {
                setCreatedBooking(null);
                setSelectedSlot(null);
                setCustomerName('');
                setCustomerPhone('');
              }}
              className="w-full text-xs text-slate-600 hover:text-slate-900 py-1"
            >
              Yeni Randevu Al
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800 block">
                1. Hizmet Seçin
              </label>
              {loadingServices ? (
                <p className="text-xs text-slate-400">Hizmetler yükleniyor...</p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {services.map((service) => {
                    const active = service.id === selectedServiceId;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => {
                          setSelectedServiceId(service.id);
                          setSelectedSlot(null);
                        }}
                        className={`text-left p-3 rounded-xl border transition ${
                          active
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
                        }`}
                      >
                        <div className="text-sm font-semibold">{service.name}</div>
                        <div className={`text-xs mt-1 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                          {service.duration_minutes} dk • {service.price} TL
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="date-input" className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>2. Tarih Seçin</span>
              </label>
              <input
                id="date-input"
                type="date"
                min={getTodayDateStr()}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-900"
              />
              {dateSchedule && !dateSchedule.is_closed && (
                <p className="text-[11px] text-slate-500">
                  Çalışma saatleri: {dateSchedule.open_time.slice(0, 5)} - {dateSchedule.close_time.slice(0, 5)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>3. Müsait Saat Seçin</span>
              </label>
              {dateSchedule?.is_closed ? (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                  Seçilen günde dükkan kapalıdır. Lütfen başka bir gün seçin.
                </p>
              ) : loadingSlots ? (
                <p className="text-xs text-slate-400">Saatler kontrol ediliyor...</p>
              ) : availableSlots.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  Bu tarih ve hizmet süresi için uygun saat bulunamadı. Başka bir gün seçebilirsiniz.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {availableSlots.map((slot) => {
                    const isSelected = selectedSlot?.start_time === slot.start_time;
                    return (
                      <button
                        key={slot.start_time}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 px-2 rounded-lg text-xs font-semibold border transition ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        {slot.start_time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1 mb-1">
                  <User className="w-3.5 h-3.5" />
                  <span>Ad Soyad</span>
                </label>
                <input
                  type="text"
                  placeholder="Örn: Ahmet Yılmaz"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1 mb-1">
                  <Phone className="w-3.5 h-3.5" />
                  <span>Telefon Numarası</span>
                </label>
                <input
                  type="tel"
                  placeholder="05XX XXX XX XX"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !selectedSlot}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl text-sm transition"
            >
              {submitting ? 'Kaydediliyor...' : 'Randevuyu Onayla'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}