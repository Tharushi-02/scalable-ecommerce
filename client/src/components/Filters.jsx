import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../api/client.js';

export default function Filters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api('/categories', { auth: false })
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  // Change some values in the URL; empty values are removed. Always back to page 1.
  function update(changes) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value == null) next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    setSearchParams(next);
  }

  function handleSearch(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    update({
      q: form.get('q').trim(),
      minPrice: form.get('minPrice'),
      maxPrice: form.get('maxPrice'),
    });
  }

  const hasFilters = [...searchParams.keys()].some((key) => key !== 'page');

  return (
    <div className="filters">
      {/* key: when the URL changes (e.g. Back button), refill the boxes from it */}
      <form key={searchParams.toString()} onSubmit={handleSearch} className="filters-search">
        <input
          name="q"
          type="search"
          placeholder="Search products…"
          defaultValue={searchParams.get('q') ?? ''}
        />
        <input
          name="minPrice"
          type="number"
          min="0"
          step="0.01"
          placeholder="Min Rs."
          defaultValue={searchParams.get('minPrice') ?? ''}
        />
        <input
          name="maxPrice"
          type="number"
          min="0"
          step="0.01"
          placeholder="Max Rs."
          defaultValue={searchParams.get('maxPrice') ?? ''}
        />
        <button type="submit" className="button">
          Search
        </button>
      </form>

      <div className="filters-row">
        <select
          value={searchParams.get('category') ?? ''}
          onChange={(e) => update({ category: e.target.value })}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get('sort') ?? 'newest'}
          onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })}
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="name_asc">Name: A–Z</option>
        </select>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={searchParams.get('inStock') === 'true'}
            onChange={(e) => update({ inStock: e.target.checked ? 'true' : '' })}
          />
          In stock only
        </label>

        {hasFilters && (
          <button type="button" className="link-button" onClick={() => setSearchParams({})}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}