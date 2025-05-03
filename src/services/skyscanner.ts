/**
 * Represents flight information including price and dates.
 */
export interface Flight {
  /**
   * The price of the flight.
   */
  price: number;
  /**
   * The departure date of the flight.
   */
  departureDate: string;
}

/**
 * Represents search criteria for flights, including origin, destination, and dates.
 */
export interface FlightSearchCriteria {
  /**
   * The origin airport code.
   */
  origin: string;
  /**
   * The destination airport code.
   */
  destination: string;
  /**
   * The departure date.
   */
  departureDate: string;
}

/**
 * Asynchronously retrieves flight information based on the provided search criteria.
 *
 * @param searchCriteria The criteria to use for searching flights.
 * @returns A promise that resolves to an array of Flight objects representing available flights.
 */
export async function getFlights(searchCriteria: FlightSearchCriteria): Promise<Flight[]> {
  // TODO: Implement this by calling an API.

  return [
    {
      price: 200,
      departureDate: searchCriteria.departureDate,
    },
  ];
}
