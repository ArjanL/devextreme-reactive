import { NODE_CHECK, rowsToTree, treeToRows } from '../../utils/hierarchical-data';

const AND = predicates => row =>
  predicates.reduce((acc, predicate) => acc && predicate(row), true);

const OR = predicates => row =>
  predicates.reduce((acc, predicate) => acc || predicate(row), false);

const operators = { or: OR, and: AND };

const toLowerCase = value => String(value).toLowerCase();

const defaultPredicate = (value, filter) =>
  toLowerCase(value).indexOf(toLowerCase(filter.value)) > -1;

const filterTree = (tree, predicate) =>
  tree.reduce((acc, node) => {
    if (node[NODE_CHECK]) {
      const filteredChildren = filterTree(node.children, predicate);
      if (filteredChildren.length > 0) {
        acc.push({
          ...node,
          children: filteredChildren,
        });
        return acc;
      } else if (predicate(node.root)) {
        acc.push(node.root);
        return acc;
      }
    }

    if (predicate(node)) {
      acc.push(node);
      return acc;
    }

    return acc;
  }, []);

const filterHierarchicalRows = (rows, predicate, getRowLevelKey, isGroupRow) => {
  const tree = rowsToTree(rows, getRowLevelKey);

  const filteredTree = filterTree(
    tree,
    row => (isGroupRow(row)
      ? row.collapsedRows && row.collapsedRows.findIndex(predicate) > -1
      : predicate(row)),
  );

  return treeToRows(filteredTree);
};

const buildPredicate = (
  initialFilterExpression,
  getCellValue,
  getColumnPredicate,
) => {
  const getSimplePredicate = (filterExpression) => {
    const { columnName } = filterExpression;
    const customPredicate = getColumnPredicate && getColumnPredicate(columnName);
    const predicate = customPredicate || defaultPredicate;
    return row =>
      predicate(getCellValue(row, columnName), filterExpression, row);
  };

  const getOperatorPredicate = (filterExpression) => {
    const build = operators[toLowerCase(filterExpression.operator)];
    // eslint-disable-next-line no-use-before-define
    return build && build(filterExpression.filters.map(getPredicate));
  };

  const getPredicate = filterExpression =>
    getOperatorPredicate(filterExpression) ||
    getSimplePredicate(filterExpression);

  return getPredicate(initialFilterExpression);
};

export const filteredRows = (
  rows,
  filterExpression,
  getCellValue,
  getColumnPredicate,
  isGroupRow,
  getRowLevelKey,
) => {
  if (
    !(
      filterExpression &&
      Object.keys(filterExpression).length &&
      rows.length
    )
  ) {
    return rows;
  }

  const predicate = buildPredicate(
    filterExpression,
    getCellValue,
    getColumnPredicate,
  );

  return getRowLevelKey
    ? filterHierarchicalRows(rows, predicate, getRowLevelKey, isGroupRow)
    : rows.filter(predicate);
};
