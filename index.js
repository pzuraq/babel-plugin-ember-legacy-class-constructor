module.exports = function (babel) {
  const { types: t } = babel;

  return {
    name: 'ember-legacy-class-constructor',
    visitor: {
      Class(classPath) {
        for (let path of classPath.get('body.body')) {
          // loop over the body to see if a constructor exists
          if (path.node.kind === 'constructor') {
            const { body } = path.node.body;

            path.traverse({
              // iterate over the body and look for calls to `super`, convert them
              // into calls to `super.init`. These can either be

              CallExpression(path) {
                if (path.node.callee.type === 'Super') {
                  path.replaceWith(
                    t.callExpression(
                      t.memberExpression(t.super(), t.identifier('init')),
                      path.node.arguments
                    )
                  );
                }
              },

              // Sequences don't transpile correctly most of the time, if
              // one exists as the return statement pop it off and turn it into
              // a series of expressions (usually it's the result of transpiling)
              ReturnStatement(path) {
                if (path.node.argument.type === 'SequenceExpression') {
                  const expressions = path.node.argument.expressions;

                  const finalReturn = expressions.pop();
                  const expressionStatements = expressions.map(e => t.expressionStatement(e));

                  path.replaceWithMultiple(
                    ...expressionStatements,
                    finalReturn
                  );
                }
              }
            });

            // Add a constructor to call init for non-Ember Object classes
            const constructorBody = [
              t.returnStatement(
                t.callExpression(
                  t.memberExpression(
                    t.thisExpression(),
                    t.identifier('init')
                  ),
                  [
                    t.spreadElement(
                      t.identifier('arguments')
                    )
                  ]
                )
              )
            ];

            // If the class has a super class then we need to call super before
            // calling init. Call it with the value `EMBER_LEGACY_SHORT_CIRCUIT`
            // to prevent it from calling init prematurely
            if (classPath.node.superClass !== null) {
              constructorBody.unshift(
                t.expressionStatement(
                  t.callExpression(
                    t.super(),
                    [t.stringLiteral('EMBER_LEGACY_SHORT_CIRCUIT')]
                  )
                )
              );
            }

            path.replaceWithMultiple([
              t.classMethod(
                'method',
                t.identifier('init'),
                path.node.params,
                t.blockStatement(body)
              ),
              t.classMethod(
                'constructor',
                t.identifier('constructor'),
                [t.identifier('shortCircuit')],
                t.blockStatement([
                  t.ifStatement(
                    t.binaryExpression('!==', t.identifier('shortCircuit'), t.stringLiteral('EMBER_LEGACY_SHORT_CIRCUIT')),
                    t.blockStatement(constructorBody)
                  )
                ])
              )
            ]);
          }
        }
      }
    }
  };
}
