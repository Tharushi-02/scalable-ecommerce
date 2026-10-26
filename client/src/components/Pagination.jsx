import { useSearchParams } from 'react-router';

// Which page numbers to show: first, last, and 2 either side of the current one
function pageWindow(page, totalPages) {
  const wanted = [1, totalPages, page - 2, page - 1, page, page + 1, page + 2];
  const pages = [...new Set(wanted)]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  // Insert "…" wherever numbers are skipped
  const items = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) items.push('…');
    items.push(p);
  });
  return items;
}

export default function Pagination({ page, totalPages }) {
  const [searchParams, setSearchParams] = useSearchParams();

  if (totalPages <= 1) return null;

  function goTo(newPage) {
    const next = new URLSearchParams(searchParams); // keep all the filters
    if (newPage === 1) next.delete('page');
    else next.set('page', String(newPage));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <nav className="pagination" aria-label="Pages">
      <button type="button" onClick={() => goTo(page - 1)} disabled={page <= 1}>
        ‹ Prev
      </button>

      {pageWindow(page, totalPages).map((item, i) =>
        item === '…' ? (
          <span key={`gap-${i}`} className="pagination-gap">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => goTo(item)}
            className={item === page ? 'active' : undefined}
            aria-current={item === page ? 'page' : undefined}
          >
            {item}
          </button>
        ),
      )}

      <button type="button" onClick={() => goTo(page + 1)} disabled={page >= totalPages}>
        Next ›
      </button>
    </nav>
  );
}