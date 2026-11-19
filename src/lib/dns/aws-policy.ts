/**
 * The IAM documents local-cert asks an operator to paste into AWS.
 *
 * Pure functions, importable from server and client code alike: the console
 * shows them in the provider and domain wizards, the docs render them as
 * examples. They are the single source of truth for "what does local-cert need
 * on AWS" — docs/iam-policy.json is the same document for one zone.
 */

export type PolicyDocument = { Version: '2012-10-17'; Statement: Array<Record<string, unknown>> };

const zoneArn = (id: string) => `arn:aws:route53:::hostedzone/${id}`;

/**
 * Permissions for the identity that talks to Route53 (the role when the
 * provider assumes one, the IAM user otherwise).
 *
 * Listing zones cannot be scoped — Route53 only accepts "*" for it — and it is
 * what lets the console offer a zone picker. Everything that reads or writes
 * records is scoped to the listed zones, and writes are further limited to the
 * record types and actions local-cert uses.
 */
export function permissionsPolicy(zoneIds: string[], removal?: RemovalTarget): PolicyDocument {
  const doc = route53Policy(zoneIds);
  if (removal) doc.Statement.push(...removalStatements(removal));
  return doc;
}

/** The identities a provider is made of, as far as they are known. */
export interface RemovalTarget {
  /** the IAM user behind the key pair; anything else (a role, root) is ignored */
  userArn: string | null;
  roleArn: string | null;
}

export const isIamUserArn = (arn: string | null | undefined): arn is string =>
  typeof arn === 'string' && /^arn:aws[\w-]*:iam::\d{12}:user\//.test(arn);

/**
 * What lets "remove and clean up on AWS" work: the provider may delete the IAM
 * user it was given and empty its own role — nothing else, and nothing that
 * adds a right (no Put*, Attach*, Create*). A leaked key can at worst cut
 * local-cert off.
 *
 * IAM refuses to delete an identity that still has policies, and the right to
 * delete comes from those very policies, so no identity can remove itself
 * entirely. With a role, the role session deletes the user, then its own
 * policy: an empty role nobody can assume is left behind. Without one, the user
 * can only delete its own access key.
 *
 * Deleting these statements from the pasted document only disables the
 * clean-up; issuance never uses them.
 */
export function removalStatements(target: RemovalTarget): PolicyDocument['Statement'] {
  if (!isIamUserArn(target.userArn)) return [];
  if (!target.roleArn) {
    return [
      {
        Sid: 'LocalCertRemoveOwnKey',
        Effect: 'Allow',
        Action: 'iam:DeleteAccessKey',
        Resource: target.userArn,
      },
    ];
  }
  return [
    {
      Sid: 'LocalCertRemoveUser',
      Effect: 'Allow',
      Action: [
        'iam:ListAccessKeys',
        'iam:DeleteAccessKey',
        'iam:ListUserPolicies',
        'iam:DeleteUserPolicy',
        'iam:DeleteUser',
      ],
      Resource: target.userArn,
    },
    {
      Sid: 'LocalCertRemoveOwnPolicy',
      Effect: 'Allow',
      Action: ['iam:ListRolePolicies', 'iam:DeleteRolePolicy'],
      Resource: target.roleArn,
    },
  ];
}

function route53Policy(zoneIds: string[]): PolicyDocument {
  const zones = [...new Set(zoneIds)].sort().map(zoneArn);
  const statements: PolicyDocument['Statement'] = [
    {
      Sid: 'LocalCertListZones',
      Effect: 'Allow',
      Action: 'route53:ListHostedZones',
      Resource: '*',
    },
    {
      Sid: 'LocalCertPollChange',
      Effect: 'Allow',
      Action: 'route53:GetChange',
      Resource: '*',
    },
  ];
  if (zones.length > 0) {
    statements.push(
      {
        Sid: 'LocalCertReadZone',
        Effect: 'Allow',
        Action: ['route53:GetHostedZone', 'route53:ListResourceRecordSets'],
        Resource: zones,
      },
      {
        Sid: 'LocalCertWriteRecords',
        Effect: 'Allow',
        Action: 'route53:ChangeResourceRecordSets',
        Resource: zones,
        Condition: {
          'ForAllValues:StringEquals': {
            'route53:ChangeResourceRecordSetsRecordTypes': ['TXT', 'A', 'AAAA'],
            'route53:ChangeResourceRecordSetsActions': ['UPSERT', 'DELETE'],
          },
        },
      },
    );
  }
  return { Version: '2012-10-17', Statement: statements };
}

/** Trust policy of the role: only this IAM user may assume it. */
export function trustPolicy(principalArn: string): PolicyDocument {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'LocalCertAssume',
        Effect: 'Allow',
        Principal: { AWS: principalArn },
        Action: 'sts:AssumeRole',
      },
    ],
  };
}

/**
 * Identity policy of the IAM user: its only right is to assume the role.
 * Optional when user and role live in the same account (the trust policy
 * naming the user is enough), required across accounts.
 */
export function assumePolicy(roleArn: string): PolicyDocument {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'LocalCertAssumeDnsRole',
        Effect: 'Allow',
        Action: 'sts:AssumeRole',
        Resource: roleArn,
      },
    ],
  };
}

export const PLACEHOLDER_USER_ARN = 'arn:aws:iam::123456789012:user/local-cert';
export const PLACEHOLDER_ROLE_ARN = 'arn:aws:iam::123456789012:role/local-cert-dns';
