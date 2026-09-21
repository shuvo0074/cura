import { createContext, useContext, useState } from 'react';

const FilterContext = createContext();

export function FilterProvider({ children }) {
  const [filterParams, setFilterParams] = useState({
    specialty: [],
    city: [],
    division: [],
    symptom: [],
    hospital: [],
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <FilterContext.Provider value={{
      filterParams,
      setFilterParams,
      isFilterOpen,
      setIsFilterOpen,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  return useContext(FilterContext);
}
