import { useRss } from "../hooks/useRss";

export const CalendarFeed = () => {
  const { calendarEvents, loading, error } = useRss();

  if (loading) {
    return <div className="p-4 text-center">Načítavam kalendár podujatí...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>;
  }

  // Funkcia na kontrolu, či je text platný (nie je prázdny a nie je to len bodka)
  const isContentValid = (text?: string) => {
    return text && text.trim() !== "" && text.trim() !== ".";
  };

  const events = calendarEvents ?? [];

  return (
    <div className="calendar-feed">
      <h2 className="text-xl font-bold mb-4">Kalendár podujatí</h2>
      
      {events.length > 0 ? (
        <ul className="space-y-4">
          {events.map((event, index) => {
            // Preskočíme položky, ktoré nemajú názov
            if (!isContentValid(event.title)) return null;

            return (
              <li key={event.link || index} className="border-b pb-2">
                <h3 className="font-semibold">{event.title}</h3>
                
                {/* Dátum zobrazíme len ak existuje */}
                {event.pub_date && (
                  <p className="text-sm text-gray-600">
                    {new Date(event.pub_date).toLocaleDateString("sk-SK")}
                  </p>
                )}

                {/* Popis zobrazíme len ak je platný */}
                {isContentValid(event.description) && (
                  <p className="text-sm mt-1">{event.description}</p>
                )}

                {/* Link */}
                {event.link && (
                  <a 
                    href={event.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 text-sm hover:underline block mt-1"
                  >
                    Viac informácií
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-gray-500">V kalendári nie sú momentálne žiadne podujatia.</p>
      )}
    </div>
  );
};