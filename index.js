module.exports = function (babel) {
  const { types: t } = babel;

  return {
    name: 'ember-legacy-class-constructor',
    visitor: {
      Class(classPath) {
        for (let path of classPath.get('body.body')) {
          if (path.node.kind === 'constructor') {
            const { body } = path.node.body;
            const maybeReturn = body[body.length - 1];

            if (
              maybeReturn
              && maybeReturn.type === 'ReturnStatement'
              && maybeReturn.argument.type === 'SequenceExpression'
            ) {
              body.pop();

              const finalReturn = maybeReturn.argument.expressions.pop();
              const expressions = maybeReturn.argument.expressions.map(e => t.expressionStatement(e));

              body.push(...expressions, t.returnStatement(finalReturn));
            }

            for (let i = 0; i < body.length; i++) {
              const node = body[i];

              if (node.type !== 'ExpressionStatement') continue;

              const { expression } = node;

              if (
                expression.type === 'CallExpression'
                && expression.callee.type === 'Super'
              ) {
                body[i] = t.expressionStatement(
                  t.callExpression(
                    t.memberExpression(t.super(), t.identifier('init')),
                    [
                      t.spreadElement(
                        t.identifier('arguments')
                      )
                    ]
                  )
                );

                break;
              } else if (
                expression.type === 'AssignmentExpression'
                && expression.right.type === 'CallExpression'
                && expression.right.callee.type === 'Super'
              ) {
                body[i] = t.expressionStatement(
                  t.assignmentExpression(
                    '=',
                    expression.left,
                    t.callExpression(
                      t.memberExpression(t.super(), t.identifier('init')),
                      [
                        t.spreadElement(
                          t.identifier('arguments')
                        )
                      ]
                    )
                  )
                );

                break;
              }
            }

            path.replaceWith(
              t.classMethod('method', t.identifier('init'), [], t.blockStatement(body))
            )

            path.__emberLegacyConverted = true;
            break;
          }
        }
      }
    }
  };
}
