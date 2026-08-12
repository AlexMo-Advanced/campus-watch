/** Build nested comment trees from a flat list (infinite thread depth). */

export function buildCommentTree(comments) {
  const byId = new Map();
  const roots = [];

  comments.forEach((comment) => {
    byId.set(comment.id, { ...comment, children: [] });
  });

  comments.forEach((comment) => {
    const node = byId.get(comment.id);
    if (comment.parent_id && byId.has(comment.parent_id)) {
      byId.get(comment.parent_id).children.push(node);
    } else if (!comment.parent_id) {
      roots.push(node);
    }
  });

  return roots;
}

export function flattenCommentTree(nodes, depth = 0, parentName = null) {
  const rows = [];
  nodes.forEach((node) => {
    rows.push({ ...node, depth, replyToName: parentName });
    const authorName =
      node.profiles?.display_name ||
      node.author_email?.split('@')[0] ||
      'Student';
    rows.push(...flattenCommentTree(node.children || [], depth + 1, authorName));
  });
  return rows;
}

export function getCommentAuthorName(comment) {
  return (
    comment.profiles?.display_name ||
    comment.author_email?.split('@')[0] ||
    'Student'
  );
}
