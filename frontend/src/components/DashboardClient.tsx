'use client';

import { User } from '@supabase/supabase-js';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabaseClient';
import TimeSeriesChart from './TimeSeriesChart';
import StackedBarChart from './StackedBarChart';
import DataTable from './DataTable';
import FilterSelectorPopover from './FilterSelectorPopover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

// Define interfaces for filter options (assuming backend structure)
interface Option { code: string; description: string; }
interface MetricOption { metric_code: string; metric_name: string; }
interface FrequencyOption { frequency_code: string; frequency_description: string; }
// TODO: Add interface for PlantOption if needed later

// Define interface for raw API data item (matching TimeSeriesChart)
interface RawApiDataItem {
  timestamp: string;
  metric_code: string;
  fuel_code?: string;
  prime_mover_code?: string;
  state_code?: string;
  sector_code?: string;
  region_code?: string;
  subdivision_code?: string;
  value: number;
  unit_code?: string;
  detail_raw?: string;
}

interface DashboardClientProps {
  user: User;
}

// --- Default filter values ---
const defaultStartDate = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1); // Default to one year ago
  return date.toISOString().split('T')[0];
};
const defaultEndDate = () => new Date().toISOString().split('T')[0]; // Default to today

// --- Base API URL for backend ---
const API_BASE_URL = 'http://localhost:8000'; // Assuming backend runs here

const DashboardClient: React.FC<DashboardClientProps> = ({ user }) => {
  const supabase = createClient(); // Client-side instance

  // == Filter Selection State ==
  const [startDate, setStartDate] = useState<string>(defaultStartDate());
  const [endDate, setEndDate] = useState<string>(defaultEndDate());
  const [selectedFrequency, setSelectedFrequency] = useState<string>(''); // e.g., 'M' for Monthly
  const [selectedMetric, setSelectedMetric] = useState<string>(''); // Single metric for simplicity first
  const [selectedFuelCodes, setSelectedFuelCodes] = useState<string[]>([]);
  const [selectedPrimeMovers, setSelectedPrimeMovers] = useState<string[]>([]);
  const [selectedStateCodes, setSelectedStateCodes] = useState<string[]>([]); // New state for selected states
  // const [selectedPlants, setSelectedPlants] = useState<string[]>([]); // TODO: Add later if needed

  // == Filter Options State ==
  const [frequencyOptions, setFrequencyOptions] = useState<FrequencyOption[]>([]);
  const [metricOptions, setMetricOptions] = useState<MetricOption[]>([]);
  const [fuelOptions, setFuelOptions] = useState<Option[]>([]);
  const [primeMoverOptions, setPrimeMoverOptions] = useState<Option[]>([]);
  const [stateOptions, setStateOptions] = useState<Option[]>([]); // New state for state options
  // const [plantOptions, setPlantOptions] = useState<PlantOption[]>([]); // TODO: Add later if needed

  // == Loading/Error State ==
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  // == Chart State ==
  const [chartData, setChartData] = useState<RawApiDataItem[]>([]); // State holds raw data
  const [isChartLoading, setIsChartLoading] = useState<boolean>(false);
  const [chartError, setChartError] = useState<string | null>(null);

  // == Fetch Filter Options ==
  useEffect(() => {
    const fetchOptions = async () => {
      setIsLoadingFilters(true);
      setFilterError(null);
      try {
        const [freqRes, metricRes, fuelRes, moverRes, stateRes] = await Promise.all([
          fetch(`${API_BASE_URL}/dimensions/frequencies`),
          fetch(`${API_BASE_URL}/dimensions/metrics`),
          fetch(`${API_BASE_URL}/dimensions/fuel_codes`),
          fetch(`${API_BASE_URL}/dimensions/prime_movers`),
          fetch(`${API_BASE_URL}/dimensions/states`), // Fetch states
        ]);

        // Error handling
        if (!freqRes.ok) throw new Error(`Frequencies fetch failed: ${freqRes.statusText}`);
        if (!metricRes.ok) throw new Error(`Metrics fetch failed: ${metricRes.statusText}`);
        if (!fuelRes.ok) throw new Error(`Fuel Codes fetch failed: ${fuelRes.statusText}`);
        if (!moverRes.ok) throw new Error(`Prime Movers fetch failed: ${moverRes.statusText}`);
        if (!stateRes.ok) throw new Error(`States fetch failed: ${stateRes.statusText}`); // Add state error check

        const frequencies = await freqRes.json();
        const metrics = await metricRes.json();
        const fuelsRaw = await fuelRes.json();
        const moversRaw = await moverRes.json();
        const statesRaw = await stateRes.json(); // Parse states JSON

        // Log raw data received from backend for filters
        console.log('[fetchOptions] Raw Fuels Data:', fuelsRaw);
        console.log('[fetchOptions] Raw Movers Data:', moversRaw);
        console.log('[fetchOptions] Raw States Data:', statesRaw); // Log raw states

        // Transform data
        const transformedFuels: Option[] = fuelsRaw.map((fuel: any) => ({ code: fuel.fuel_code, description: fuel.fuel_description })).filter((opt: Option) => opt.code != null);
        const transformedMovers: Option[] = moversRaw.map((mover: any) => ({ code: mover.prime_mover_code, description: mover.prime_mover_description })).filter((opt: Option) => opt.code != null);
        const transformedStates: Option[] = statesRaw.map((state: any) => ({ code: state.code, description: state.description })).filter((opt: Option) => opt.code != null); // Transform states

        setFrequencyOptions(frequencies);
        setMetricOptions(metrics);
        setFuelOptions(transformedFuels);
        setPrimeMoverOptions(transformedMovers);
        setStateOptions(transformedStates); // Set state options

        // Set default frequency and metric if available
        if (frequencies.length > 0 && !selectedFrequency) {
          setSelectedFrequency(frequencies.find((f: FrequencyOption) => f.frequency_code === 'M')?.frequency_code || frequencies[0].frequency_code);
        }
        if (metrics.length > 0 && !selectedMetric) {
           // Default to 'GEN' or the first available metric
           setSelectedMetric(metrics.find((m: MetricOption) => m.metric_code === 'GEN')?.metric_code || metrics[0].metric_code);
        }

      } catch (error: any) {
        console.error("Error fetching filter options:", error);
        setFilterError(`Failed to load filter options: ${error.message}`);
      } finally {
        setIsLoadingFilters(false);
      }
    };

    fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

  // == Sign Out Handler ==
  const handleSignOut = async () => {
    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      alert(`Sign out failed: ${error.message}`); // Simple alert for now
    }
    // No need to redirect here, auth listener on home page handles state change
    setIsSigningOut(false);
  };

  // == Chart Data Fetching Logic ==
  const fetchChartData = useCallback(async () => {
    // Ensure a metric is selected and filters are loaded
    if (!selectedMetric || isLoadingFilters) {
       setChartData([]); // Clear data if no metric or filters not ready
       return;
    }

    console.log('Fetching chart data with filters:', {
        startDate, endDate, selectedFrequency, selectedMetric, selectedFuelCodes, selectedPrimeMovers, selectedStateCodes
    });
    setIsChartLoading(true);
    setChartError(null);
    setChartData([]); // Clear previous data

    // Construct query parameters
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    params.append('frequency_code', selectedFrequency);
    params.append('metric_codes', selectedMetric);

    // Corrected Parameter Appending Logic
    // Only append parameters if the arrays have values
    if (selectedFuelCodes && selectedFuelCodes.length > 0) {
      selectedFuelCodes.forEach(code => params.append('fuel_codes', code));
    }
    if (selectedPrimeMovers && selectedPrimeMovers.length > 0) {
      selectedPrimeMovers.forEach(code => params.append('prime_mover_codes', code));
    }
    // Add state codes to parameters if selected
    if (selectedStateCodes && selectedStateCodes.length > 0) {
       selectedStateCodes.forEach(code => params.append('state_codes', code));
    }
    // TODO: Add sector_codes etc. when backend supports them

    const apiUrl = `${API_BASE_URL}/data/aggregate?${params.toString()}`;
    console.log('API URL:', apiUrl); // Log the URL for debugging

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorBody = await response.text(); // Try to get error details
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
      }
      const data = await response.json();

      // TODO: Data Transformation (Step 2.4)
      // For now, just store the raw data
      console.log('Raw API data:', data);
      setChartData(data); // Store raw data for now

    } catch (error: any) {
      console.error("Error fetching chart data:", error);
      setChartError(`Failed to load chart data: ${error.message}`);
      setChartData([]); // Clear data on error
    } finally {
      setIsChartLoading(false);
    }
  }, [startDate, endDate, selectedFrequency, selectedMetric, selectedFuelCodes, selectedPrimeMovers, selectedStateCodes, isLoadingFilters]);

  // Trigger chart data fetch when filters change
  useEffect(() => {
      if (!isLoadingFilters) { // Fetch only after initial options are loaded
          fetchChartData();
      }
  }, [fetchChartData, isLoadingFilters]); // fetchChartData is memoized by useCallback

  // Handlers for multi-select checkboxes
  const handleCheckboxChange = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter(prev =>
      prev.includes(value)
        ? prev.filter(item => item !== value)
        : [...prev, value]
    );
  };

  // Helper for handling multi-select dropdown change (now accepts string array directly)
  const handleMultiSelectChange = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    values: string[]
  ) => {
    setter(values);
  };

  // Determine the groupBy key for the chart
  // If specific fuel codes or prime movers are selected, use them for grouping.
  // Otherwise, default to grouping by fuel_code (may result in 'Unknown' if data lacks it).
  const groupBy: 'fuel_code' | 'prime_mover_code' = selectedFuelCodes.length > 0
                                                  ? 'fuel_code'
                                                  : selectedPrimeMovers.length > 0
                                                    ? 'prime_mover_code'
                                                    : 'fuel_code'; // Default groupBy

  // Get the selected metric name for the chart label
  const selectedMetricName = metricOptions.find(m => m.metric_code === selectedMetric)?.metric_name || selectedMetric;

  // == Reset Filters Handler ==
  const handleResetFilters = () => {
    setStartDate(defaultStartDate());
    setEndDate(defaultEndDate());
    // Reset selects to the first available option or default
    setSelectedFrequency(frequencyOptions[0]?.frequency_code || '');
    setSelectedMetric(metricOptions.find(m => m.metric_code === 'GEN')?.metric_code || metricOptions[0]?.metric_code || '');
    // Clear multi-selects
    setSelectedFuelCodes([]);
    setSelectedPrimeMovers([]);
    setSelectedStateCodes([]); // Clear selected states on reset
    // Note: This will trigger fetchChartData via useEffect dependencies
  };

  // Log filter options state just before rendering
  console.log('[DashboardClient Render] Fuel Options State:', fuelOptions);
  console.log('[DashboardClient Render] Prime Mover Options State:', primeMoverOptions);
  console.log('[DashboardClient Render] State Options State:', stateOptions);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b p-4 sticky top-0 z-30">
        <div className="container mx-auto flex flex-wrap justify-between items-center gap-2">
          <h1 className="text-xl font-semibold">EIA Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Welcome, {user.email}</span>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="px-3 py-1 bg-red-500 text-white rounded-md text-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-70"
            >
              {isSigningOut ? 'Signing Out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </header>

      {/* Layout: Sidebar + Content */}
      <div className="container mx-auto p-4 flex flex-col lg:flex-row gap-6">
        
        {/* SIDEBAR - FILTERS */}
        <aside className="w-full lg:w-1/4 bg-white border rounded-lg shadow-sm max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-lg font-semibold">Filters</h2>
            <button
              onClick={handleResetFilters}
              disabled={isLoadingFilters}
              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Reset
            </button>
          </div>
          
          {isLoadingFilters ? (
            <div className="p-6 flex justify-center items-center">
              <div className="flex flex-col items-center text-gray-500">
                <svg className="animate-spin h-8 w-8 text-blue-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-sm">Loading filters...</p>
              </div>
            </div>
          ) : filterError ? (
            <div className="p-6 flex justify-center items-center">
              <div className="inline-flex items-center bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">
                <span className="text-2xl mr-3">⚠️</span>
                <div>
                  <p className="font-semibold mb-1">Error Loading Filters</p>
                  <p className="text-sm">{filterError}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-6 overflow-y-auto">
              {/* Date Range Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Date Range</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="start-date" className="text-xs mb-1 block">Start Date</Label>
                    <Input
                      type="date"
                      id="start-date"
                      value={startDate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date" className="text-xs mb-1 block">End Date</Label>
                    <Input
                      type="date"
                      id="end-date"
                      value={endDate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                      min={startDate}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Metric and Frequency Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Data Options</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="metric" className="text-xs mb-1 block">Metric</Label>
                    <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                      <SelectTrigger id="metric" className="w-full">
                        <SelectValue placeholder="Select Metric" />
                      </SelectTrigger>
                      <SelectContent>
                        {metricOptions.map((opt) => (
                          <SelectItem key={opt.metric_code} value={opt.metric_code}>
                            {opt.metric_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="frequency" className="text-xs mb-1 block">Frequency</Label>
                    <Select value={selectedFrequency} onValueChange={setSelectedFrequency}>
                      <SelectTrigger id="frequency" className="w-full">
                        <SelectValue placeholder="Select Frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {frequencyOptions.map((opt) => (
                          <SelectItem key={opt.frequency_code} value={opt.frequency_code}>
                            {opt.frequency_description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Multi-Select Filters Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Dimensions</h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs mb-1 block">States</Label>
                    <FilterSelectorPopover
                      label="States"
                      options={stateOptions}
                      selectedValues={selectedStateCodes}
                      onChange={(values) => handleMultiSelectChange(setSelectedStateCodes, values)}
                      placeholder="Select States..."
                      className="w-full"
                    />
                  </div>

                  <div>
                    <Label className="text-xs mb-1 block">Fuel Types</Label>
                    <FilterSelectorPopover
                      label="Fuel Types"
                      options={fuelOptions}
                      selectedValues={selectedFuelCodes}
                      onChange={(values) => handleMultiSelectChange(setSelectedFuelCodes, values)}
                      placeholder="Select Fuel Types..."
                      className="w-full"
                    />
                  </div>

                  <div>
                    <Label className="text-xs mb-1 block">Prime Movers</Label>
                    <FilterSelectorPopover
                      label="Prime Movers"
                      options={primeMoverOptions}
                      selectedValues={selectedPrimeMovers}
                      onChange={(values) => handleMultiSelectChange(setSelectedPrimeMovers, values)}
                      placeholder="Select Prime Movers..."
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Plant Search Filter Placeholder */}
              <div className="space-y-1">
                <Label htmlFor="plant-search" className="text-xs">Plant</Label>
                <div className="relative">
                  <Input
                    type="text"
                    id="plant-search"
                    placeholder="Search plants..."
                    disabled
                    className="w-full pr-16"
                  />
                  <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Soon</span>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* MAIN CONTENT */}
        <main className="w-full lg:w-3/4 bg-white border rounded-lg shadow-sm space-y-8 p-6">
          {/* First Chart */}
          <div className="border rounded-lg p-4">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {selectedMetricName || "Metric"} Over Time
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({groupBy.replace(/_/g, ' ').toUpperCase()})
                </span>
              </h2>
            </div>
            <div className="min-h-[400px] flex items-center justify-center">
              {isChartLoading ? (
                <div className="text-center text-gray-500">
                  <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading chart data...
                </div>
              ) : chartError ? (
                <div className="text-center max-w-md bg-red-50 p-4 rounded-lg border border-red-200 text-red-700">
                  <span className="text-2xl block mb-2">⚠️</span>
                  <p className="font-medium mb-1">Error Loading Chart</p>
                  <p className="text-sm">{chartError}</p>
                </div>
              ) : (
                <TimeSeriesChart
                  rawData={chartData}
                  isLoading={false}
                  error={null}
                  metricName={selectedMetricName}
                  groupBy={groupBy}
                />
              )}
            </div>
          </div>

          {/* Second Chart */}
          <div className="border rounded-lg p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">
                Composition Over Time
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({groupBy.replace(/_/g, ' ').toUpperCase()})
                </span>
              </h2>
            </div>
            <div className="min-h-[400px] flex items-center justify-center">
              {isChartLoading ? (
                <div className="text-center text-gray-500">
                  <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading chart data...
                </div>
              ) : chartError ? (
                <div className="text-center max-w-md bg-red-50 p-4 rounded-lg border border-red-200 text-red-700">
                  <span className="text-2xl block mb-2">⚠️</span>
                  <p className="font-medium mb-1">Error Loading Chart</p>
                  <p className="text-sm">{chartError}</p>
                </div>
              ) : (
                <StackedBarChart
                  rawData={chartData}
                  isLoading={false}
                  error={null}
                  metricName={selectedMetricName}
                  groupBy={groupBy}
                />
              )}
            </div>
          </div>

          {/* Data Table */}
          <div className="border rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Raw Data</h2>
            <DataTable
              data={chartData}
              isLoading={isChartLoading}
              error={chartError}
            />
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-gray-100 p-4 text-center text-sm text-gray-600 mt-4">
        © {new Date().getFullYear()} WattCanvas EIA Dashboard
      </footer>
    </div>
  );
};

export default DashboardClient;