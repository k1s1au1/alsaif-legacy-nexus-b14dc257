/**
 * Generates and downloads an .ics file for mobile/desktop calendar integration
 */
export function addToCalendar({ title, description, location, startTime, durationMinutes }: {
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  durationMinutes?: number;
}) {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + (durationMinutes || 60) * 60 * 1000);

  const formatICSDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Alsaif Nexus//Calendar Integration//EN',
    'BEGIN:VEVENT',
    `SUMMARY:${title}`,
    `DTSTART:${formatICSDate(start)}`,
    `DTEND:${formatICSDate(end)}`,
    `DESCRIPTION:${description || ''}`,
    `LOCATION:${location || ''}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const icsString = icsLines.join('\r\n');
  const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${title.replace(/\s+/g, '_')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
