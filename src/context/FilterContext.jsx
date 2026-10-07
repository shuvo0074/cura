import { createContext, useContext, useState } from 'react';
import { EMPTY_FILTERS } from '../utils/doctorFilters';

const FilterContext = createContext();

export function FilterProvider({ children }) {
  const [filterParams, setFilterParams] = useState(EMPTY_FILTERS);

  return (
    <FilterContext.Provider value={{
      filterParams,
      setFilterParams,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  return useContext(FilterContext);
}
