import { boundingBox, distanceKm } from './geo.utils';

describe('geo utils', () => {
  it('computes the distance between two points', () => {
    // Two points ~10.7 km apart (Leiria centre -> Marinha Grande).
    expect(distanceKm(39.7436, -8.8071, 39.7478, -8.9318)).toBeCloseTo(10.7, 0);
  });

  it('builds a bbox whose edges are `radius` away from the centre', () => {
    const [south, west, north, east] = boundingBox(39.74, -8.81, 2);
    expect(distanceKm(39.74, -8.81, north, -8.81)).toBeCloseTo(2, 1);
    expect(distanceKm(39.74, -8.81, south, -8.81)).toBeCloseTo(2, 1);
    expect(distanceKm(39.74, -8.81, 39.74, east)).toBeCloseTo(2, 1);
    expect(distanceKm(39.74, -8.81, 39.74, west)).toBeCloseTo(2, 1);
  });
});
