
// nchoosek: Generates k-combinations from a given array.
export const nchoosek = <T,>(arr: T[], k: number): T[][] => {
  if (k < 0 || k > arr.length) {
    return [];
  }
  if (k === 0) {
    return [[]];
  }
  if (k === arr.length) {
    return [arr];
  }
  if (k === 1) {
    return arr.map(item => [item]);
  }

  const combinations: T[][] = [];
  const recurse = (startIdx: number, currentCombo: T[]):void => {
    if (currentCombo.length === k) {
      combinations.push([...currentCombo]);
      return;
    }
    if (startIdx >= arr.length) {
      return;
    }

    // Include current element
    currentCombo.push(arr[startIdx]);
    recurse(startIdx + 1, currentCombo);
    currentCombo.pop();

    // Exclude current element
    recurse(startIdx + 1, currentCombo);
  };
  
  // Optimization: if k > arr.length / 2, choose arr.length - k instead
  // For simplicity, direct implementation:
  const combinationIndices: number[][] = [];
  const buildIndices = (startIndex: number, currentIndices: number[]): void => {
    if (currentIndices.length === k) {
      combinationIndices.push([...currentIndices]);
      return;
    }
    if (startIndex >= arr.length) {
      return;
    }
    // Include current index
    currentIndices.push(startIndex);
    buildIndices(startIndex + 1, currentIndices);
    currentIndices.pop();
    // Skip current index
    if (arr.length - (startIndex + 1) >= k - currentIndices.length) {
         buildIndices(startIndex + 1, currentIndices);
    }
  };

  buildIndices(0, []);
  return combinationIndices.map(indices => indices.map(i => arr[i]));
};


// heaviside: Heaviside step function. Returns 1 if x >= 0, else 0.
export const heaviside = (x: number): number => (x >= 0 ? 1 : 0);
    